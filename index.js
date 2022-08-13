const { Telegraf, Scenes, Composer, session, Markup} = require('telegraf');
const { CallbackData } = require('@bot-base/callback-data');
const storybl = require('./modebl');
const storylin = require('./modelink');
const story = require ('./story');
const {DataTypes} = require('sequelize');
const sequelize = require('./db');
require ('dotenv').config();
const PORT = process.env.PORT || 3000;
const { BOT_TOKEN} = process.env;
const bot = new Telegraf(BOT_TOKEN)
const flagBtn = new CallbackData('flagBtn', ['number', 'action']);

if (BOT_TOKEN === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

try {
  sequelize.authenticate()
  //sequelize.sync({ force: true })
  console.log('Соединение с БД было успешно установлено.')
} catch (e) {
  console.log('Невозможно выполнить подключение к БД ', e)
}

story.hasMany(storybl);
story.hasMany(storylin);

bot.start ((ctx) => ctx.reply(`Привет, ${ctx.message.from.first_name ? ctx.message.from.first_name : 'незнакомец!'}`))

const baseEmpty = new Composer()
baseEmpty.on ('text', async (ctx)=>{
  ctx.wizard.state.data = {};
  const count = await story.count({where: {
    authId: ctx.message.from.id, 
    release: false,
  }});
  if (count > 0) {
    await ctx.reply ('История уже создаётся!');
    return ctx.scene.leave()
  }
  await ctx.reply('Введите название.', Markup.keyboard(
    [
    ['🔙Выйти']
  ]))
  return ctx.wizard.next()
})

const storyName = new Composer()
storyName.on ('text', async (ctx)=>{
  if (ctx.message.text === '🔙Выйти') 
  {
    await ctx.reply ('Операция прошла успешно.');
    return ctx.scene.leave()
  }
  ctx.wizard.state.data.storyName = ctx.message.text;
  await ctx.reply ('Введите описание истории');
  return ctx.wizard.next()
})

const storyDesc = new Composer()
storyDesc.on ('text', async (ctx)=>{
  if (ctx.message.text === '🔙Выйти') 
  {
    await ctx.reply ('Операция прошла успешно.');
    return ctx.scene.leave()
  }
  ctx.wizard.state.data.storyDesc = ctx.message.text;
  await ctx.reply ('Введите текст открывающего блока (блок, за которым последует первый выбор).');
  const t = await sequelize.transaction();
  try{
    const result = await sequelize.transaction(async (t) => {
    const query = await story.create({
    name: `${ctx.wizard.state.data.storyName}`,
    desc: `${ctx.wizard.state.data.storyDesc}`,
    authId: ctx.message.from.id,
    release: false
  }, { transaction: t });
})
await t.commit('commit');
} catch (error) {
  await t.rollback();
}
  return ctx.wizard.next()
})

const baseSave = new Composer()
baseSave.on ('text', async (ctx)=>{
  ctx.wizard.state.data.baseSave = ctx.message.text;
  const t = await sequelize.transaction();
  try{
    const { count, rows } = await story.findAndCountAll({where: {
      authId: ctx.message.from.id,
      release: false}});
    let c = count - 1;
    const result = await sequelize.transaction(async (t) => {
    const query = await storybl.create({
    linid: 0,
    bl: `${ctx.wizard.state.data.baseSave}`,
    authId: ctx.message.from.id,
    storyId: rows[c].id,
    release: false
  }, { transaction: t });
})
await t.commit('commit');
} catch (error) {
  await t.rollback();
}
  await ctx.reply ('Вы успешно добавили первый блок своей будущей истории.');
  return ctx.scene.leave()
})

const menuCreate = new Scenes.WizardScene('sceneCreate', baseEmpty, storyName, storyDesc, baseSave)
const stage = new Scenes.Stage ([menuCreate])
bot.use(session())
bot.use(stage.middleware())
bot.command ('make', async (ctx) => ctx.scene.enter('sceneCreate'))










const blockEmpty = new Composer()
blockEmpty.on ('text', async (ctx)=>{
ctx.wizard.state.data = {};
try{
  const { count, rows } = await storybl.findAndCountAll({where: {
    authId: ctx.message.from.id,
    release: false
  }});
  if (count <= 0) {
    await ctx.reply ('Надо создать историю! 👉 /make');
    return ctx.scene.leave()
  }
  let x = count - 1;
  for (let i=0; i<=x; i++){
    await ctx.reply(`${rows[i].bl}`, Markup.inlineKeyboard(
      [
      [Markup.button.callback('👆', flagBtn.create({
        number: rows[i].id,
        action: 'true'}))]
    ]
    )
  )
  }
} catch (e){
  console.log(e);
  await ctx.replyWithHTML('<i>Ошибка!</i>')
}
  return ctx.wizard.next()
})

const blockChoice = new Composer()
blockChoice.on ('callback_query', async (ctx)=>{
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.blockChoice = number;
  await ctx.reply ('Введите текст ссылки.');
  return ctx.wizard.next()
})

const blockLink = new Composer()
blockLink.on ('text', async (ctx)=>{
  ctx.wizard.state.data.blockLink = ctx.message.text;
  const {count, rows} = await storybl.findAndCountAll({where: {
    authId: ctx.message.from.id,
    release: false
  }});
  const t = await sequelize.transaction();
  try{
    const resul = await sequelize.transaction(async (t) => {
    const quer = await storylin.create({
    link: `${ctx.wizard.state.data.blockLink}`,
    authId: ctx.message.from.id,
    release: false,
    storyblId: `${ctx.wizard.state.data.blockChoice}`,
    storyId: `${rows[0].storyId}`
  }, { transaction: t });
})
await t.commit('commit');
} catch (error) {
  await ctx.reply ('Ошибка! Попробуйте сначала.');
  await t.rollback();
  return ctx.scene.leave()
}
  await ctx.reply ('Вы успешно добавили ссылку.');
  return ctx.scene.leave()
})

const menuLink = new Scenes.WizardScene('sceneLink', blockEmpty, blockChoice, blockLink)
const stagee = new Scenes.Stage ([menuLink])
bot.use(session())
bot.use(stagee.middleware())
bot.command ('link', async (ctx) => ctx.scene.enter('sceneLink'))










const linkEmpty = new Composer()
linkEmpty.on ('text', async (ctx)=>{
ctx.wizard.state.data = {};
try{
  const row = await story.findOne({where: {
    authId: ctx.message.from.id,
    release: false
  }});
  if (row === null) {
    await ctx.reply ('Надо создать историю! 👉 /make');
    return ctx.scene.leave()
  }
  const { count, rows } = await storylin.findAndCountAll({where: {storyId: row.id}});
  await ctx.reply ('Выберите ссылку из доступных:');
    let x = count - 1;
    for (let i=0; i<=x; i++){
      const ro = await storybl.findOne({where:{
        authId: ctx.message.from.id,
        release: false,
        linid: rows[i].id,
        storyId: row.id
      }})
      if (ro === null){
      await ctx.reply(`${rows[i].link}`, Markup.inlineKeyboard(
        [
        [Markup.button.callback('👆', flagBtn.create({
          number: rows[i].id,
          action: 'true'}))]
            ]
          )
        )
      }
    }
  } catch (e){
    console.log(e);
    await ctx.replyWithHTML('<i>Ошибка!</i>')
  }
  return ctx.wizard.next()
})

const linkChoice = new Composer()
linkChoice.on ('callback_query', async (ctx)=>{
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.linkChoice = number;
  try{
  const count = await storybl.count({where: {
    linid: ctx.wizard.state.data.linkChoice,
    authId: ctx.callbackQuery.from.id,
    release: false
  }});
  if (count > 0){
    await ctx.reply('Ошибка! Эта ссылка уже ведёт к одному из блоков!')
    return ctx.scene.leave()
  }
} catch(e){
  await ctx.reply('Произошла ошибка!')
  return ctx.scene.leave()
}
  await ctx.reply ('Введите текст блока.');
  return ctx.wizard.next()
})

const linkBlock = new Composer()
linkBlock.on ('text', async (ctx)=>{
  ctx.wizard.state.data.linkBlock = ctx.message.text;
  const t = await sequelize.transaction();
  try{
  const row = await story.findOne({where: {
    authId: ctx.message.from.id,
    release: false
  }});
    const resul = await sequelize.transaction(async (t) => {
    const quer = await storybl.create({
    linid: ctx.wizard.state.data.linkChoice,
    bl: `${ctx.wizard.state.data.linkBlock}`,
    authId: ctx.message.from.id,
    release: false,
    storyId: row.id,
  }, { transaction: t });
})
await t.commit('commit');
} catch (error) {
  await ctx.reply ('Ошибка! Пожалуйста попробуйте сначала.');
  await t.rollback();
  return ctx.scene.leave()
}
  await ctx.reply ('Вы успешно добавили блок.');
  return ctx.scene.leave()
})

const menuBlock = new Scenes.WizardScene('sceneBlock', linkEmpty, linkChoice, linkBlock)
const stager = new Scenes.Stage ([menuBlock])
bot.use(session())
bot.use(stager.middleware())
bot.command ('block', async (ctx) => ctx.scene.enter('sceneBlock'))








const playScene = new Composer()
playScene.on('text', async (ctx) => {
  ctx.wizard.state.data = {};
  try{
    const row = await story.findOne({where: {
      authId: ctx.message.from.id,
      release: false
    }});
    await ctx.reply(`🎫 ${row.name}`)
    await ctx.reply (`📖 ${row.desc}`)
    await ctx.reply('Начать читать?', Markup.inlineKeyboard(
      [
      [Markup.button.callback('👆', flagBtn.create({
        number: 0,
        action: 'true'}))]
    ]))
  } catch (e){
    ctx.reply('Вы не добавили ни одной истории!')
}
return ctx.wizard.next()
})


const playMech = new Composer()
playMech.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery();
  //let res = await ctx.reply ('✅');
  //for (let d = res.message_id - 1; d >= 0; d--){
    //try {
     // let del = await ctx.deleteMessage(d);
  //} catch (e) {
  //    console.error(e);
  //}
 // }
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.playMech = number;
  try{
  const ro = await story.findOne({where: {
    authId: ctx.callbackQuery.from.id,
    release: false
  }});
  const row = await storybl.findOne({where: {
    linid: ctx.wizard.state.data.playMech,
    storyId: ro.id,
    authId: ctx.callbackQuery.from.id,
    release: false
  }
});
await ctx.reply(`${row.bl}`);
  const {count, rows} = await storylin.findAndCountAll ({where: {
    authId: ctx.callbackQuery.from.id,
    release: false,
    storyblId: row.id
  }});
  if (count < 1) {
    await ctx.reply('Вы завершили прохождение истории!');
    return ctx.scene.leave()
  }

  let x = count - 1;
  for (let i = 0; i <= x; i++){
    await ctx.reply(`${rows[i].link}`, Markup.inlineKeyboard(
      [
      [Markup.button.callback('👆', flagBtn.create({
        number: rows[i].id,
        action: 'true'}))]
    ]
    )
  )
  }
} catch(e){
  await ctx.reply('Ошибка!');
}
return ctx.wizard.selectStep(1)
})

const playmenuScene = new Scenes.WizardScene('playScene', playScene, playMech)
const staget = new Scenes.Stage([playmenuScene])
bot.use(session())
bot.use(staget.middleware())
bot.command('play', async (ctx) => ctx.scene.enter('playScene'))







const deleteScene = new Scenes.BaseScene('delete')
deleteScene.enter((ctx) => {
  ctx.session.myData = {};
  ctx.reply('Выберите вид удаляемого элемента:', Markup.inlineKeyboard(
    [
    [Markup.button.callback('Историю', 'Story'), Markup.button.callback('Сюжетную ветку', 'Branch')]
  ]))
});
deleteScene.action('Story', async (ctx) => {
  ctx.session.myData.preferenceType = 'Story';

  await story.destroy({
    where: {
      authId: ctx.callbackQuery.from.id,
      release: false
    }
  });
  await storybl.destroy({
    where: {
      authId: ctx.callbackQuery.from.id,
      release: false
    }
  });
  await storylin.destroy({
    where: {
      authId: ctx.callbackQuery.from.id,
      release: false
    }
  });

  await ctx.reply('Создаваемая история была успешна удалена.');
  return ctx.scene.leave();
});

deleteScene.action('Branch', async (ctx) => {
  ctx.session.myData.preferenceType = 'Branch';
  try{
    const row = await story.findOne({where: {
      authId: ctx.callbackQuery.from.id,
      release: false
    }});
    if (row === null) {
      await ctx.reply ('Требуется создать историю! 👉 /make');
      return ctx.scene.leave()
    }
    const { count, rows } = await storylin.findAndCountAll({where: {storyId: row.id}});
    if (count < 1) {
      await ctx.reply ('Требуется больше ссылок! 👉 /link');
      return ctx.scene.leave()
    }
    await ctx.reply ('Выберите ссылку, после которой требуется удалить контент (включая ссылку):');
      let x = count - 1;
      for (let i=0; i<=x; i++){
        await ctx.reply(`${rows[i].link}`, Markup.inlineKeyboard(
          [
          [Markup.button.callback('❌', flagBtn.create({
            number: rows[i].id,
            action: 'true'}))]
        ]
        )
      )
      }
    } catch (e){
      console.log(e);
      await ctx.replyWithHTML('<i>Ошибка!</i>')
    }
});

deleteScene.action(flagBtn.filter({action: 'true'}), async (ctx) => {
  await ctx.answerCbQuery()
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  console.log(number);
  ctx.session.myData.preferenceType = number;
  try{
  /*const row = story.findOne({where: {
    authId: ctx.callbackQuery.from.id,
    release: false,
  }})*/
  await storylin.destroy({ 
    where: { 
    id: ctx.session.myData.preferenceType,
    authId: ctx.callbackQuery.from.id,
    release: false,
    //storyId: row.id
}
})
  await storybl.destroy({ 
    where: { 
    linid: ctx.session.myData.preferenceType,
    authId: ctx.callbackQuery.from.id,
    release: false,
    //storyId: row.id
}
});

for (; ;){
  const {count, rows} = await storylin.findAndCountAll({where: {
    authId: ctx.callbackQuery.from.id,
    release: false,
    storyblId: null,
    //storyId: row.id
  }})
  if (count<1){
    break
  }
  let x = count - 1;
  for (let i=0; i<=x; i++){
  await storybl.destroy({
    where:{
      linid: rows[i].id,
      authId: ctx.callbackQuery.from.id,
      release: false
      }
    })
    await storylin.destroy({
      where:{
        id: rows[i].id,
        authId: ctx.callbackQuery.from.id,
        release: false
      }
    })
    }
  }
  await ctx.reply ('Ветка удалена.')
      
} catch(e){
  await ctx.reply('Ошибка!')
}
  return ctx.scene.leave();
})

deleteScene.leave((ctx) => {
  ctx.reply('Операция успешно завершена.');
});
deleteScene.use((ctx) => ctx.replyWithMarkdown('Пожалуйста выберите, что нужно удалить.'));

const staged = new Scenes.Stage([deleteScene])
bot.use(session())
bot.use(staged.middleware())
bot.command('delete', (ctx) => ctx.scene.enter('delete'))







const editChoice = new Composer()
editChoice.on ('text', async (ctx)=>{
  ctx.wizard.state.data = {};
  ctx.reply('Выберите вид редактируемого элемента:', Markup.inlineKeyboard(
    [
    [Markup.button.callback('Название', flagBtn.create({
      number: 1,
      action: 'true'})), 
      Markup.button.callback('Описание', flagBtn.create({
        number: 2,
        action: 'true'})
        )],
    [Markup.button.callback('Блок', flagBtn.create({
      number: 3,
      action: 'true'})), 
      Markup.button.callback('Ссылка', flagBtn.create({
        number: 4,
        action: 'true'}))]
  ]))
  return ctx.wizard.next()
})

const editChoiceTrue = new Composer()
editChoiceTrue.on ('callback_query', async (ctx)=>{
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.editChoiceTrue = number;
  if (ctx.wizard.state.data.editChoiceTrue = 1){
    await ctx.reply('Введите новое название')
    ctx.wizard.selectStep(2)
  }
  if (ctx.wizard.state.data.editChoiceTrue = 2){
    await ctx.reply('Введите новое описание')
    ctx.wizard.selectStep(3)
  }
  if (ctx.wizard.state.data.editChoiceTrue = 3){
    await ctx.reply('Выберите блок, который хотите отредактровать:')
    ctx.wizard.selectStep(4)
  }
  if (ctx.wizard.state.data.editChoiceTrue = 4){
    await ctx.reply('Выберите ссылку, который хотите отредактровать:')
    ctx.wizard.selectStep(5)
  }
})
const editStory = new Composer()
editStory.on ('text', async (ctx)=>{
  const { number, action } = flagBtn.parse(ctx.callbackQuery.data);
  ctx.wizard.state.data.editStory = ctx.message.text;
  await story.update({ name: `${ctx.wizard.state.data.editStory}` }, {
    where: {
      authId: ctx.message.from.id,
      release: false,
    }
  });
  return ctx.scene.leave()
  })

  const editDesc = new Composer()
  editDesc.on ('text', async (ctx)=>{
  return ctx.scene.leave()
  })

  const editBlock = new Composer()
editBlock.on ('text', async (ctx)=>{
  return ctx.scene.leave()
  })

  const editLink = new Composer()
editLink.on ('text', async (ctx)=>{
  return ctx.scene.leave()
  })

const menuEdit = new Scenes.WizardScene('editScene', editChoice, editChoiceTrue, editStory, editDesc, editBlock, editLink)
const stageu = new Scenes.Stage ([menuEdit])
bot.use(session())
bot.use(stageu.middleware())
bot.command ('edit', async (ctx) => ctx.scene.enter('editScene'))






bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))