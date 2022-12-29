const { Telegraf, Scenes, Composer, session, Markup} = require('telegraf');
const { CallbackData } = require('@bot-base/callback-data');
const storybl = require('./modebl');
const storylin = require('./modelink');
const story = require ('./story');
const like = require ('./like');
const sequelize = require('./db');
require ('dotenv').config();
const PORT = process.env.PORT || 3000;
const { BOT_TOKEN} = process.env;
const bot = new Telegraf(BOT_TOKEN, {
  polling: true,
  autoStart: true,
  interval: 300,
  params:{
    timeout: 10
  }
});
const user = require ('./user');
const safety = require ('./safety');

if (BOT_TOKEN === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

try {
  sequelize.authenticate()
  sequelize.sync()
  console.log('Соединение с БД было успешно установлено.')
} catch (e) {
  console.log('Невозможно выполнить подключение к БД ', e)
}


bot.on('text', async (ctx, next) => {
  await safety(ctx.message.from.id, ctx.message.date, ctx.message.from.is_bot);
  const row = await user.findOne({where:{
    authId: ctx.message.from.id
  }})
  if (row.ban == true){
    await ctx.reply ('Вы забанены!')
  }
  else{
    await next()
  }
})
bot.on('callback_query', async (ctx, next) => {
  await safety(ctx.callbackQuery.from.id, ctx.callbackQuery.date, ctx.callbackQuery.from.is_bot);
  const row = await user.findOne({where:{
    authId: ctx.callbackQuery.from.id
  }})
  if (row.ban == true){
    await ctx.reply ('Вы забанены!')
  }
  else{
    await next()
  }
})




const searchChoiceBtn = new CallbackData('searchChoiceBtn', ['number', 'action']);
const searchBtn = new CallbackData('searchBtn', ['number', 'name', 'action']);
const likeBtn = new CallbackData('likeBtn', ['number', 'action']);

const searchChoiceScene = new Composer()

searchChoiceScene.on('text', async (ctx) => {
  try{
  ctx.wizard.state.data = {};
  await ctx.reply('Фильтр поиска', Markup.inlineKeyboard(
    [
    [Markup.button.callback('По названию', searchChoiceBtn.create({
    number: '1',
    action: 'filter'}))],
    [Markup.button.callback('По номеру', searchChoiceBtn.create({
      number: '2',
      action: 'filter'}))],
    [Markup.button.callback('Актуальное🔴', searchChoiceBtn.create({
      number: '3',
      action: 'filter'}))],
    [Markup.button.callback('ТОП-5 популярных👀', searchChoiceBtn.create({
      number: '4',
      action: 'filter'}))],
    ])
  );
} catch(e){
  await ctx.reply('⚠Ошибка!');
  return ctx.scene.leave()
}
return ctx.wizard.next()
})
const searchScene = new Composer()
searchScene.on('callback_query', async (ctx) => {
 
  const { number, action } = searchChoiceBtn.parse(ctx.callbackQuery.data);
  if (action != 'filter'){
    await ctx.answerCbQuery('⚠Ошибка!');
    return ctx.scene.leave()
  }
  ctx.wizard.state.data.searchScene = ctx.callbackQuery.message.date;
  switch (number) {
    case '1':
  await ctx.reply('Введите название искомой истории');
  return ctx.wizard.next()
  break;
    case '2':
  await ctx.reply('Введите номер искомой истории');
  return ctx.wizard.selectStep(3)
      break;
    case '3':
  const {count, rows} = await story.findAndCountAll({where:{
    release: true
  }})
  let x = count - 1;
  let y = count - 5;
  for (let i = x; i >= y && i>=0; i--){
    const coun = await like.count({where:{
      story: rows[i].id
    }})
    await ctx.replyWithHTML (`<u>№${rows[i].id} 📚 ${rows[i].name}</u>
<i>👀 ${rows[i].views}, ⭐ +${coun}</i>`, Markup.inlineKeyboard(
      [
        [Markup.button.callback('👆', searchBtn.create({
      number: rows[i].id,
      name: rows[i].name,
      action: 'storyreadlast'}))
        ]
        ])
    ) 
  }
  return ctx.wizard.selectStep(4)
      break;
      case '4':
        try{
  const {count, rows} = await story.findAndCountAll({
    where:{
      release: true
    },
    order: [
      ['views', 'DESC']
    ]
  })
  let x = count - 1
  for (let u = 0; u <= 4 && u<=x; u++){
    const cou = await like.count({where:{
      story: rows[u].id
    }})
    await ctx.replyWithHTML (`<u>№${rows[u].id} 📚 ${rows[u].name}</u>
<i>👀 ${rows[u].views}, ⭐ +${cou}</i>`, Markup.inlineKeyboard(
      [
        [Markup.button.callback('👆', searchBtn.create({
      number: rows[u].id,
      name: rows[u].name,
      action: 'storyreadpopular'}))
        ]
        ])
    ) 
  }
  return ctx.wizard.selectStep(4)
} catch(e){
  await ctx.reply('⚠Ошибка!');
  return ctx.scene.leave()
}
      break;
  }
  return ctx.scene.leave()

})
const choiceScene = new Composer()
choiceScene.on('text', async (ctx) => {
  try{
  ctx.wizard.state.data.choiceScene = ctx.message.text;
  const {count, rows} = await story.findAndCountAll({where:{
    name: ctx.wizard.state.data.choiceScene,
    release: true,
  }})
  if (count < 1){
    await ctx.reply('⚠Историй с таким названием нет!');
    return ctx.scene.leave()
  }
  let x = count - 1;
  for (let i = 0; i <= x; i++) {
    const coun = await like.count({where:{
      story: rows[i].id
    }})
    await ctx.replyWithHTML (`<u>№${rows[i].id} 📚 ${rows[i].name}</u>
<i>👀 ${rows[i].views}, ⭐ +${coun}</i>`, Markup.inlineKeyboard(
      [
        [Markup.button.callback('👆', searchBtn.create({
      number: rows[i].id,
      name: rows[i].name,
      action: 'storyreadname'}))
        ]
        ])
    )
  }
} catch(e){
  await ctx.reply('⚠Ошибка!');
  return ctx.scene.leave()
}
return ctx.wizard.selectStep(4)
})
const numberScene = new Composer()
numberScene.on('text', async (ctx) => {
  try{
  ctx.wizard.state.data.numberScene = ctx.message.text;
  const {count, rows} = await story.findAndCountAll({where:{
    id: ctx.wizard.state.data.numberScene,
    release: true,
  }})
  if (count < 1){
    await ctx.reply('⚠Историй с таким номером нет!');
    return ctx.scene.leave()
  }
  let x = count - 1;
  for (let i = 0; i <= x; i++) {
    const coun = await like.count({where:{
      story: rows[i].id
    }})
    await ctx.replyWithHTML (`<u>№${rows[i].id} 📚 ${rows[i].name}</u>
<i>👀 ${rows[i].views}, ⭐ +${coun}</i>`, Markup.inlineKeyboard(
      [
        [Markup.button.callback('👆', searchBtn.create({
      number: rows[i].id,
      name: rows[i].name,
      action: 'storyreadnumber'}))
        ]
        ])
    )
  }
} catch(e){
  await ctx.reply('⚠Ошибка!');
  return ctx.scene.leave()
}
return ctx.wizard.next()
})
const readScene = new Composer()
readScene.on('callback_query', async (ctx) => {
  try{
  const { number, name, action } = searchBtn.parse(ctx.callbackQuery.data);
    if (action != 'storyreadname' && action != 'storyreadnumber' && action != 'storyreadlast' && action != 'storyreadpopular'){
      await ctx.answerCbQuery('⚠Ошибка!');
      return ctx.scene.leave()
    }
    
    await story.increment({ views: 1}, {
      where: {
        id: number
      }});
  await ctx.answerCbQuery(`Вы выбрали историю "${name}"`);
  ctx.wizard.state.data.readScene = number;
    const row = await story.findOne({where: {
      id: `${ctx.wizard.state.data.readScene}`,
      release: true,
    }});
    if (row===null){
      await ctx.reply('Вы не добавили ни одной истории!')
      return ctx.scene.leave()
    }
    if (row.pic != null) await ctx.replyWithPhoto({ url: `${row.pic}` }, { caption: `🎫 ${row.name}`});
    else  await ctx.reply(`🎫 ${row.name}`);
    await ctx.reply (`📜 ${row.desc}`)
    await ctx.reply('Начать читать?', Markup.inlineKeyboard(
      [
      [Markup.button.callback('👆', searchBtn.create({
        number: 0,
        name: ctx.wizard.state.data.searchScene,
        action: `storyreadtrue${ctx.wizard.state.data.readScene}`}))]
    ]))
  } catch (e){
    await ctx.reply('⚠Ошибка!')
    return ctx.scene.leave()
}
return ctx.wizard.next()
})

const readSceneTrue = new Composer()
readSceneTrue.on('callback_query', async (ctx) => {
  try{
    await ctx.answerCbQuery();
    const { number, name, action } = searchBtn.parse(ctx.callbackQuery.data);

    ctx.wizard.state.data.readSceneTrue = number;
    
    if (action != `storyreadtrue${ctx.wizard.state.data.readScene}`){
      await ctx.reply('⚠Ошибка!');
      return ctx.scene.leave()
    }
    if (name != ctx.wizard.state.data.searchScene) {
      await ctx.reply('⚠Ошибка!');
      return ctx.scene.leave()
    }
    const rov = await storylin.findOne({where:{
      id: ctx.wizard.state.data.readSceneTrue,
      storyId: ctx.wizard.state.data.readScene,
    }})
    var r = rov;
    if (rov != null){
      const count = await storylin.count({where:{
        storyblId: r.storyblId,
        storyId: ctx.wizard.state.data.readScene
      }})
      
      await ctx.reply (`${r.smile} ${r.link}`)
    }
  const row = await storybl.findOne({where: {
    linid: ctx.wizard.state.data.readSceneTrue,
    storyId: ctx.wizard.state.data.readScene,
    release: true
  }
});
if (row.pic != null) {
  let res = await ctx.replyWithPhoto({ url: `${row.pic}` }, { caption: `${row.bl}`});
}
else {
  let res = await ctx.reply(`${row.bl}`);
}
  const {count, rows} = await storylin.findAndCountAll ({where: {
    release: true,
    storyblId: row.id,
    storyId: ctx.wizard.state.data.readScene
  }});
  if (count < 1) {
    const rov = await like.findOne({where:{
        authId: ctx.callbackQuery.from.id,
        story: ctx.wizard.state.data.readScene
    }})
    console.log(rov);
    if (rov === null){
      await ctx.reply('Прохождение одной из сюжетных ветвей окончено, поставьте оценку.', Markup.inlineKeyboard(
        [
        [Markup.button.callback('👍', likeBtn.create({
          number: ctx.wizard.state.data.readScene,
          action: `storylike${ctx.wizard.state.data.readScene}`}))],
        [Markup.button.callback('Пропустить', likeBtn.create({
          number: ctx.wizard.state.data.readScene,
          action: `storylikenull${ctx.wizard.state.data.readScene}`}))]
        ],
      )
    );
    return ctx.wizard.next()
    }
    await ctx.reply('Прохождение одной из сюжетных ветвей окончено, поставьте оценку.', Markup.inlineKeyboard(
      [
      [Markup.button.callback('👎', likeBtn.create({
        number: ctx.wizard.state.data.readScene,
        action: `storydislike${ctx.wizard.state.data.readScene}`}))],
      [Markup.button.callback('Пропустить', likeBtn.create({
        number: ctx.wizard.state.data.readScene,
        action: `storylikenull${ctx.wizard.state.data.readScene}`}))]
      ],
    )
  );
    return ctx.wizard.next()
  }
  let x = count - 1;
  for (let i = 0; i <= x; i++){
    await ctx.reply(`${rows[i].link}`, Markup.inlineKeyboard(
      [
      [Markup.button.callback(`${rows[i].smile}`, searchBtn.create({
        number: rows[i].id,
        name: ctx.wizard.state.data.searchScene,
        action: `storyreadtrue${ctx.wizard.state.data.readScene}`}))]
    ]
    )
  )
  }
} catch(e){
  await ctx.answerCbQuery('⚠Ошибка!');
  await ctx.reply('Вы завершили прохождение истории!');
  return ctx.scene.leave()
}
return ctx.wizard.selectStep(5)
})
const likeScene = new Composer()
likeScene.on('callback_query', async (ctx) => {
  try{
    
  await ctx.replyWithHTML (`🔚Прохождение истории окончено:
  /start - главное меню
  /myprofile - мой профиль`)
  const { number, action } = likeBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.likeScene = action;
  switch (ctx.wizard.state.data.likeScene) {
    case `storylike${ctx.wizard.state.data.readScene}`:
      const t = await sequelize.transaction();
  try{
    const row = await like.findOne({
      where:{
        authId: ctx.callbackQuery.from.id,
        story: ctx.wizard.state.data.readScene,
      }
    })
    if (row === null) {
    await ctx.answerCbQuery('👍');
    const resul = await sequelize.transaction(async (t) => {
      const likeCr = await like.create ({
        authId: ctx.callbackQuery.from.id,
        story: ctx.wizard.state.data.readScene,
      }, { transaction: t })
    })
    await t.commit('commit');
  }
  else{
    await ctx.answerCbQuery('⚠Ошибка!');
    return ctx.scene.leave()
  }
  } catch (error) {
    await ctx.reply ('⚠Ошибка!');
    await t.rollback();
    return ctx.scene.leave()
  }
    return ctx.scene.leave()
    break;


    case `storydislike${ctx.wizard.state.data.readScene}`:
    const ro = await like.findOne({where:{
      story: ctx.wizard.state.data.readScene,
      authId: ctx.callbackQuery.from.id
    }})
    if (ro != null){
      await ctx.answerCbQuery('👎');
      await like.destroy ({where:{
        story: ctx.wizard.state.data.readScene,
        authId: ctx.callbackQuery.from.id
      }})
      return ctx.scene.leave()
    }
    else{
      await ctx.answerCbQuery('⚠Ошибка!');
      return ctx.scene.leave()
    }
    break;

    case `storylikenull${ctx.wizard.state.data.readScene}`:
      await ctx.answerCbQuery('🔚');
      return ctx.scene.leave()
    break;
    default:
      await ctx.reply('⚠Ошибка!')
      return ctx.scene.leave()
  }
  } catch (e){
    await ctx.reply('⚠Ошибка!')
    return ctx.scene.leave()
}
return ctx.scene.leave()
})

const readmenuScene = new Scenes.WizardScene('readScene', searchChoiceScene, searchScene, choiceScene, numberScene, readScene, readSceneTrue, likeScene)
const stager = new Scenes.Stage([readmenuScene])
bot.use(session())
bot.use(stager.middleware())
bot.command('start', async (ctx) => ctx.scene.enter('readScene'))


const profileBtn = new CallbackData('profileBtn', ['number', 'action']);

const profileScene = new Scenes.BaseScene('profile')
profileScene.enter(async (ctx) => {
  try{
  ctx.session.myData = {};
  ctx.reply(`Имя: ${ctx.message.from.first_name}`, Markup.inlineKeyboard(
    [
    [Markup.button.callback('Мои истории📚', 'mystory')], 
    [Markup.button.callback('Любимые истории💜', 'likedstory')],
  ]))
}
catch(e){
  await ctx.reply('⚠Ошибка!');
  return ctx.scene.leave();
}
});

profileScene.action('mystory', async (ctx) => {
  try{
  ctx.session.myData.preferenceType = 'story';
  const {count, rows} = await story.findAndCountAll({where:{
    authId: ctx.callbackQuery.from.id,
    release: true,
  }})
 
  if (count < 1) {
    await ctx.answerCbQuery('⚠Для этой функции требуется опубликовать историю!');
    return ctx.scene.leave();
  }
  let x = count - 1;
  for (let i = 0; i <= x; i++) {
    const coun = await like.count({where:{
      story: rows[i].id
    }})
    await ctx.replyWithHTML (`<u>№${rows[i].id} 📚 ${rows[i].name}</u>
<i>👀 ${rows[i].views}, ⭐ +${coun}</i>`, Markup.inlineKeyboard(
      [
        [Markup.button.callback('❌Удалить историю', profileBtn.create({
      number: rows[i].id,
      action: 'deletestory'}))
        ]
        ])
    )
  }
}catch(e){
  await ctx.answerCbQuery('⚠Ошибка!');
  return ctx.scene.leave();
}
});


profileScene.action(profileBtn.filter({action: 'deletestory'}), async (ctx) => {
  try{
  const { number, action } = profileBtn.parse(ctx.callbackQuery.data);
  console.log(number);
  const count = await story.count({where:{
    authId: ctx.callbackQuery.from.id,
    release: true,
  }})
  const row = await story.findOne({where:{
    id: `${number}`,
    release: true
  }})
  await story.destroy({
    where:{
      id: `${number}`,
      release: true
      }
    })
  await storybl.destroy({
    where:{
      authId: `${ctx.callbackQuery.from.id}`,
      storyId: null,
      release: true
      }
      })
  await storylin.destroy({
    where:{
      authId: `${ctx.callbackQuery.from.id}`,
      storyId: null,
      release: true
      }
      })
  await like.destroy({
    where:{
      story: `${number}`
    }
  })
  ctx.session.myData.preferenceType = number;
    await ctx.reply(`История "${row.name}" была удалена.`);
    }catch(e){
    await ctx.answerCbQuery('⚠Ошибка!')
    return ctx.scene.leave();
  }
    return ctx.scene.leave();
  })


profileScene.action('likedstory', async (ctx) => {
  try{
  ctx.session.myData.preferenceType = 'likedstory';
  const {count, rows} = await like.findAndCountAll({where:{
    authId: ctx.callbackQuery.from.id,
  }})
    if (count<1) {
      await ctx.answerCbQuery('⚠Для этой функции требуется лайкнуть историю!');
      return ctx.scene.leave();
    }
    await ctx.reply ('Любимые истории:');
      let x = count - 1;
      for (let i=0; i<=x; i++){
        const row = await story.findOne({where: {
          id: rows[i].story,
          release: true
        }});
        const coun = await like.count({where:{
          story: row.id
        }})
        await ctx.replyWithHTML (`<u>№${row.id} 📚 ${row.name}</u>
<i>👀 ${row.views}, ⭐ +${coun}</i>`)
      }
      return ctx.scene.leave();
    } catch (e){
      await ctx.answerCbQuery('⚠Ошибка!')
      return ctx.scene.leave();
    }
});

profileScene.use(async (ctx) =>{ 
return ctx.scene.leave()});

const stagep = new Scenes.Stage([profileScene])
bot.use(session())
bot.use(stagep.middleware())

bot.command('myprofile', (ctx) => ctx.scene.enter('profile'))

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))