import { SeiAgentKit } from "../src";
import { createSeiTools } from "../src/langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import { ModelProviderName } from "../src/types";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> =>
  new Promise((resolve) => rl.question(prompt, resolve));

function checkRequiredEnvVars(): void {
  const missingVars: string[] = [];
  const requiredVars = ["OPENAI_API_KEY", "SEI_PRIVATE_KEY", "RPC_URL"];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

async function setupAgent() {
  try {
    
    // const llm = new ChatOpenAI({
    //   model: "gpt-4o",
    //   temperature: 0,
    // });
    const llm = new ChatAnthropic({
      model: "claude-3-7-sonnet-latest",
      temperature: 0,
    });
  

    const agentInstance = new SeiAgentKit(
      process.env.SEI_PRIVATE_KEY!,
      ModelProviderName.ANTHROPIC,
    );
    const agentTools = createSeiTools(agentInstance);

    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Sei Agent Kit!" } };

    const agent = createReactAgent({
      llm,
      tools: agentTools,
      checkpointSaver: memory,
      messageModifier: `
        You are a lively and witty agent created by Cambrian AI, designed to interact onchain using the Sei Agent Kit. 
        You have a knack for humor and enjoy making the interaction enjoyable while being efficient. 
        If there is a 5XX (internal) HTTP error code, humorously suggest the user try again later, perhaps with a joke about servers needing a coffee break. 
        All users' wallet infos are already provided on the tool kit. If someone asks you to do something you
        can't do with your currently available tools, respond with a playful apology and encourage them to implement it
        themselves using the Sei Agent Kit repository that they can find on https://github.com/CambrianAgents/sei-agent-kit. 
        When performing actions using sei remember to always hold at least 0.1 for the transactions fee.
        Suggest they visit the Twitter account https://x.com/cambrian_ai or the website https://www.cambrian.wtf/ for more information, perhaps with a light-hearted comment about the wonders of the internet. Be concise, helpful, and sprinkle in some humor with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
        If the user tries to exit the conversation, cheerfully inform them that by typing "bye" they can end the conversation, maybe with a friendly farewell message.
      `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

async function runAutonomousMode(agent: any, config: any, prompt: string, interval = 10) {
  console.log("\nStarting autonomous mode...");

  while (true) {
    try {
      const thought =
        `Your are an autonomour agent that can perform actions on the sei blockchain. Follow this strategy and perform the requuested actions:
        `+prompt+`Start by breaking up the task and creating a plan. Then follow the plan. 
        Don't expect anymore inputs from the user, just use the available tools to try to complete tasks. You are completely autonomous.`;

      const stream = await agent.stream(
        { messages: [new HumanMessage(thought)] },
        config,
      );

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}


async function startInteractiveSession(agent: any, config: any) {
  console.log("\nStarting chat with the Cambrian Agent... Type 'bye' to end.");

  try {
    while (true) {
      const userInput = await question("\nYou: ");

      if (userInput.toLowerCase() === "bye") {
        break;
      }

      const responseStream = await agent.stream(
        { messages: [new HumanMessage(userInput)] },
        config,
      );

      for await (const responseChunk of responseStream) {
        if ("agent" in responseChunk) {
          console.log("\nCambrian Agent:", responseChunk.agent.messages[0].content);
        } else if ("tools" in responseChunk) {
          console.log("\nCambrian Agent:", responseChunk.tools.messages[0].content);
        }
        console.log("\n-----------------------------------\n");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('\x1b[38;2;201;235;52m%s\x1b[0m', `
  ███████╗███████╗██╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗    ██╗  ██╗██╗████████╗
  ██╔════╝██╔════╝██║     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝    ██║ ██╔╝██║╚══██╔══╝
  ███████╗█████╗  ██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║       █████╔╝ ██║   ██║   
  ╚════██║██╔══╝  ██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║       ██╔═██╗ ██║   ██║   
  ███████║███████╗██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║       ██║  ██╗██║   ██║   
  ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝╚═╝   ╚═╝   
`);
    const { agent, config } = await setupAgent();
    const mode = await question("Choose mode:\n(1) Chat\n(2) Autonomous\n\nYou: ");

    if (mode.trim() === "2") {
      const thought = await question("Describe the strategy of the agent:\n")
      await runAutonomousMode(agent, config, thought);
      return;
    }
    await startInteractiveSession(agent, config);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

export { setupAgent, startInteractiveSession, runAutonomousMode };

if (require.main === module) {
  checkRequiredEnvVars();
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
