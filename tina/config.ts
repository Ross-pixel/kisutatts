import { defineConfig } from 'tinacms'

const branch = 'main'

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: { outputFolder: 'admin', publicFolder: 'public' },
  media: { tina: { mediaRoot: 'uploads', publicFolder: 'public' } },
  schema: { collections: [
    {
      name: 'homepage',
      label: 'Главная страница',
      path: 'content/homepage',
      format: 'mdx',
      ui: {
        global: true,
        router: () => '/',
      },
      fields: [
        { type:'string', name:'title', label:'Название документа', isTitle:true, required:true },
        { type:'string', name:'heroTitle', label:'Hero · имя', required:true },
        { type:'string', name:'heroKickerEn', label:'Hero · строка сверху (EN)' },
        { type:'string', name:'heroKickerFi', label:'Hero · строка сверху (FI)' },
        { type:'string', name:'heroLeadEn', label:'Hero · подзаголовок (EN)' },
        { type:'string', name:'heroLeadFi', label:'Hero · подзаголовок (FI)' },
        { type:'string', name:'location', label:'Hero · локация' },
        { type:'image', name:'heroImage', label:'Hero · фотография' },
        { type:'string', name:'aboutTitleEn', label:'Обо мне · заголовок (EN)' },
        { type:'string', name:'aboutTitleFi', label:'Обо мне · заголовок (FI)' },
        { type:'string', name:'aboutTextEn', label:'Обо мне · текст (EN)', ui:{ component:'textarea' } },
        { type:'string', name:'aboutTextFi', label:'Обо мне · текст (FI)', ui:{ component:'textarea' } },
        { type:'image', name:'aboutImage', label:'Обо мне · фотография' },
        { type:'string', name:'portfolioTitleTop', label:'Портфолио · заголовок сверху' },
        { type:'string', name:'portfolioTitleAccent', label:'Портфолио · акцентная строка' },
        { type:'string', name:'portfolioTextEn', label:'Портфолио · текст (EN)' },
        { type:'string', name:'portfolioTextFi', label:'Портфолио · текст (FI)' },
        { type:'string', name:'onSkinTitleEn', label:'На коже · заголовок (EN)' },
        { type:'string', name:'onSkinTitleFi', label:'На коже · заголовок (FI)' },
        { type:'string', name:'onSkinTextEn', label:'На коже · текст (EN)', ui:{ component:'textarea' } },
        { type:'string', name:'onSkinTextFi', label:'На коже · текст (FI)', ui:{ component:'textarea' } },
        { type:'string', name:'priceIntroEn', label:'Flash · вступление (EN)', ui:{ component:'textarea' } },
        { type:'string', name:'priceIntroFi', label:'Flash · вступление (FI)', ui:{ component:'textarea' } },
        { type:'string', name:'contactTextEn', label:'Контакты · текст (EN)', ui:{ component:'textarea' } },
        { type:'string', name:'contactTextFi', label:'Контакты · текст (FI)', ui:{ component:'textarea' } },
      ],
    },
    {
      name: 'pricing',
      label: 'Цены Flash',
      path: 'content/pricing',
      format: 'mdx',
      ui: {
        global: true,
        router: () => '/flash',
      },
      fields: [
        { type:'string', name:'title', label:'Название документа', isTitle:true, required:true },
        {
          type:'object',
          name:'items',
          label:'Карточки цен',
          list:true,
          ui: {
            itemProps: (item) => {
              const min = item?.priceMin
              const max = item?.priceMax
              const hasMin = typeof min === 'number' && Number.isFinite(min)
              const hasMax = typeof max === 'number' && Number.isFinite(max)
              const price = hasMin ? `${min}${hasMax && max !== min ? `–${max}` : ''}€` : ''
              const title = item?.titleEn || item?.titleFi || 'Новая карточка цены'
              return { label: price ? `${price} · ${title}` : title }
            },
          },
          fields:[
            { type:'number', name:'priceMin', label:'Цена от, €', required:true },
            { type:'number', name:'priceMax', label:'Цена до, €', description:'Оставь пустым, если это не диапазон' },
            { type:'string', name:'titleEn', label:'Название (EN)', required:true },
            { type:'string', name:'titleFi', label:'Название (FI)' },
            { type:'string', name:'descriptionEn', label:'Описание (EN)', ui:{ component:'textarea' } },
            { type:'string', name:'descriptionFi', label:'Описание (FI)', ui:{ component:'textarea' } },
          ],
        },
      ],
    },
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
