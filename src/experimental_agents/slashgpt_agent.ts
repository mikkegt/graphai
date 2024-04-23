import path from "path";
import { AgentFunction } from "@/graphai";
import { ChatSession, ChatConfig, ManifestData } from "slashgpt";

const config = new ChatConfig(path.resolve(__dirname));

export const slashGPTAgent: AgentFunction<
  {
    manifest: ManifestData;
    query?: string;
    function_result?: boolean;
  },
  {
    content: string;
  },
  string
> = async ({ params, inputs, debugInfo: { verbose, nodeId } }) => {
  if (verbose) {
    console.log("executing", nodeId, params);
  }
  const session = new ChatSession(config, params.manifest ?? {});

  const query = params?.query ? [params.query] : [];
  const contents = query.concat(inputs);

  session.append_user_question(contents.join("\n"));
  await session.call_loop(() => {});
  const message = (() => {
    if (params?.function_result) {
      return session.history.messages().find((m) => m.role === "function_result");
    }
    return session.history.last_message();
  })();
  if (message === undefined) {
    throw new Error("No message in the history");
  }
  return message;
};
