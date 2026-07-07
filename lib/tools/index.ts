import { imageGenTool } from "./image-gen";
import { webSearchTool } from "./web-search";
import { curlTool } from "./curl";
import { datetimeTool } from "./datetime";

export { imageGenTool, webSearchTool, curlTool, datetimeTool };

export const agentTools = [
  imageGenTool,
  webSearchTool,
  curlTool,
  datetimeTool,
];
