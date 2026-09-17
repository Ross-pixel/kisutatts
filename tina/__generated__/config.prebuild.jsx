// tina/config.ts
import { defineConfig } from "tinacms";
var branch = "main";
var config_default = defineConfig({
  branch,
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
      { type: "string", name: "category", label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", options: ["Flora", "B&W", "Color", "ALT", "Custom"] },
      { type: "rich-text", name: "description", label: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F / \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u044B" },
      { type: "image", name: "sketch", label: "\u042D\u0441\u043A\u0438\u0437" },
      { type: "image", name: "onSkin", label: "\u0422\u0430\u0442\u0443 \u043D\u0430 \u043A\u043E\u0436\u0435" },
      { type: "image", name: "healed", label: "\u0417\u0430\u0436\u0438\u0432\u0448\u0430\u044F \u0442\u0430\u0442\u0443\u0438\u0440\u043E\u0432\u043A\u0430" },
      { type: "boolean", name: "featured", label: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u043E\u0439", defaultValue: false },
      { type: "image", name: "image", label: "\u0421\u0442\u0430\u0440\u043E\u0435 \u0444\u043E\u0442\u043E (\u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C)" }
    ] }
  ] }
});
export {
  config_default as default
};
