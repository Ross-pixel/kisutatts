// tina/config.ts
import { defineConfig } from "tinacms";
var config_default = defineConfig({
  branch: process.env.VERCEL_GIT_COMMIT_REF || "main",
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: "admin", publicFolder: "public" },
  media: { tina: { mediaRoot: "uploads", publicFolder: "public" } },
  schema: { collections: [
    { name: "flashDesigns", label: "Flash-\u043C\u043E\u0434\u0435\u043B\u0438", path: "content/flash", format: "mdx", fields: [
      { type: "string", name: "title", label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", isTitle: true, required: true },
      { type: "string", name: "price", label: "\u0426\u0435\u043D\u0430" },
      { type: "string", name: "category", label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" },
      { type: "image", name: "image", label: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430" },
      { type: "rich-text", name: "description", label: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }
    ] },
    { name: "onSkinWorks", label: "\u0422\u0430\u0442\u0443 \u043D\u0430 \u043A\u043E\u0436\u0435", path: "content/on-skin", format: "mdx", fields: [
      { type: "string", name: "title", label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", isTitle: true, required: true },
      { type: "string", name: "category", label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" },
      { type: "image", name: "image", label: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430" },
      { type: "rich-text", name: "description", label: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }
    ] },
    { name: "portfolio", label: "\u041F\u043E\u0440\u0442\u0444\u043E\u043B\u0438\u043E", path: "content/portfolio", format: "mdx", fields: [
      { type: "string", name: "title", label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", isTitle: true, required: true },
      { type: "string", name: "category", label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", options: ["Flora", "B&W", "Color", "Healed", "ALT", "Custom"] },
      { type: "string", name: "price", label: "\u0426\u0435\u043D\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, 75\u20AC)" },
      { type: "image", name: "image", label: "\u0424\u043E\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B" },
      { type: "rich-text", name: "description", label: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }
    ] }
  ] }
});
export {
  config_default as default
};
