import { createClient } from "tinacms/dist/client";
import { queries } from "./types.js";
export const client = createClient({ url: process.env.NEXT_PUBLIC_TINA_API_URL || "http://localhost:4001/graphql", token: process.env.TINA_TOKEN, queries,  });
export default client;
  
