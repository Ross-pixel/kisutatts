import { defineConfig } from 'tinacms'

const branch = 'main'

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: 'admin', publicFolder: 'public' },
  media: { tina: { mediaRoot: 'uploads', publicFolder: 'public' } },
  schema: { collections: [
    { name:'homepage', label:'Тексты сайта', path:'content/homepage', format:'mdx', fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true}
    ] },
    { name:'flashDesigns', label:'Flash-модели', path:'content/flash', format:'mdx', ui: { router: ({ document }) => `/flash/${document._sys.filename}` }, fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},
      {type:'string',name:'price',label:'Цена'},
      {type:'string',name:'category',label:'Категория'},
      {type:'image',name:'image',label:'Картинка'},
      {type:'rich-text',name:'description',label:'Описание'}
    ] },
    { name:'onSkinWorks', label:'Тату на коже', path:'content/on-skin', format:'mdx', ui: { router: ({ document }) => `/on-skin/${document._sys.filename}` }, fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},
      {type:'string',name:'category',label:'Категория'},
      {type:'image',name:'image',label:'Картинка'},
      {type:'rich-text',name:'description',label:'Описание'}
    ] },
    { name:'portfolio', label:'Портфолио', path:'content/portfolio', format:'mdx', ui: { router: ({ document }) => `/portfolio/${document._sys.filename}` }, fields:[
      {type:'string',name:'title',label:'Название',isTitle:true,required:true},
      {type:'string',name:'category',label:'Категория',options:['Flora','B&W','Color','ALT','Custom']},
      {type:'rich-text',name:'description',label:'История / описание работы'},
      {type:'image',name:'sketch',label:'Эскиз'},
      {type:'image',name:'onSkin',label:'Тату на коже'},
      {type:'image',name:'healed',label:'Зажившая татуировка'},
      {type:'boolean',name:'featured',label:'Показывать на главной',defaultValue:false},
      {type:'image',name:'image',label:'Старое фото (совместимость)'}
    ] },
  ]},
})
