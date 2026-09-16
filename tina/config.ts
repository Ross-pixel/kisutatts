import { defineConfig } from 'tinacms'

const branch = 'main'

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: 'admin', publicFolder: 'public' },
  media: { tina: { mediaRoot: 'uploads', publicFolder: 'public' } },
  schema: { collections: [
    { name:'flashDesigns', label:'Flash-модели', path:'content/flash', format:'mdx', fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},{type:'string',name:'price',label:'Цена'},{type:'string',name:'category',label:'Категория'},{type:'image',name:'image',label:'Картинка'},{type:'rich-text',name:'description',label:'Описание'}] },
    { name:'onSkinWorks', label:'Тату на коже', path:'content/on-skin', format:'mdx', fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},{type:'string',name:'category',label:'Категория'},{type:'image',name:'image',label:'Картинка'},{type:'rich-text',name:'description',label:'Описание'}] },
    { name:'portfolio', label:'Портфолио', path:'content/portfolio', format:'mdx', fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},{type:'string',name:'category',label:'Категория',options:['Flora','B&W','Color','Healed','ALT','Custom']},{type:'string',name:'price',label:'Цена (например, 75€)'},{type:'image',name:'image',label:'Фото работы'},{type:'rich-text',name:'description',label:'Описание'}] },
  ]},
})
