const { MongoClient } = require('mongodb');
const env = require('../src/config/env');
const genAISettingsService = require('../src/services/genAISettingsService');

(async () => {
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const masterDb = client.db('master');
  const tenants = await masterDb.collection('tenantInfo').find({}).toArray();

  console.log('Migrating genAISettings for tenants:', tenants.map(t => t.name || t.tenantId));

  for (const t of tenants) {
    const tCode = (t.tenantId || t.code || 'default').toLowerCase();
    const tName = t.name || t.tenantName || tCode;
    const dbName = t.tenantDb || (tCode.startsWith('iso_') ? tCode : 'iso_' + tCode);
    const db = client.db(dbName);

    // Get bots in this tenant
    const bots = await db.collection('chatClientSettings').find({}).toArray();
    console.log('\n--- DB:', dbName, 'found bots:', bots.length);

    await db.collection('genAISettings').deleteMany({});

    if (bots.length === 0) {
      const defaultSettings = genAISettingsService.getDefaultSettings('ISOBot', tName);
      await db.collection('genAISettings').insertOne({
        ...defaultSettings,
        updatedAt: new Date(),
        createdAt: new Date()
      });
      console.log(`Seeded genAISettings for generic bot in ${dbName}`);
    } else {
      for (const bot of bots) {
        const botId = bot.botId || bot.code || bot.name || 'ISOBot';
        const botName = bot.botName || bot.name || botId;
        const defaultSettings = genAISettingsService.getDefaultSettings(botId, tName);
        
        const tailored = {
          ...defaultSettings,
          botId,
          tenantFullName: tName,
          defaultFallbackAnswer: `<p class="msgcontent">I'm sorry; I do not have enough information in my knowledge base to answer that question accurately. Can you please rephrase or provide additional details? Alternatively, you may contact our ${tName} support team for assistance.</p>`,
          updatedAt: new Date(),
          createdAt: new Date()
        };

        await db.collection('genAISettings').insertOne(tailored);
        console.log(`Seeded clean genAISettings for bot "${botId}" (${botName}) in ${dbName}`);
      }
    }
  }

  console.log('\nMigration completed successfully.');
  await client.close();
})().catch(console.error);
