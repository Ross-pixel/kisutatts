import { defineConfig } from 'tinacms'

export default defineConfig({
  branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: 'admin', publicFolder: 'public' },
  media: { tina: { mediaRoot: 'uploads', publicFolder: 'public' } },
  schema: { collections: [
    { name:'portfolio', label:'Портфолио', path:'content/portfolio', format:'mdx', fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},{type:'string',name:'category',label:'Категория',options:['Flora','B&W','Color','Healed','ALT','Custom']},{type:'string',name:'price',label:'Цена (например, 75€)'},{type:'image',name:'image',label:'Фото работы'},{type:'rich-text',name:'description',label:'Описание'}] },
    { name:'faq', label:'FAQ и Уход', path:'content/faq', format:'mdx', fields:[{type:'string',name:'question',label:'Вопрос',isTitle:true,required:true},{type:'rich-text',name:'answer',label:'Ответ'}] },
  ]},
})
