const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Determine environment
const rawEnv = (process.env.NODE_ENV || process.env.ENV || 'test').toLowerCase();
const envMap = {
  test: 'test', testing: 'test', dev: 'test', development: 'test',
  stage: 'stage', staging: 'stage',
  prod: 'prod', production: 'prod'
};
const activeEnv = envMap[rawEnv] || 'test';

const envCandidatePaths = [
  path.join(__dirname, '..', 'envs', `.env.${activeEnv}`),
  path.join(__dirname, '..', '..', 'envs', `.env.${activeEnv}`),
  path.join(__dirname, '..', `.env.${activeEnv}`),
  path.join(__dirname, '..', 'envs', '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env')
];

let loadedEnvPath = null;
for (const envPath of envCandidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    loadedEnvPath = envPath;
    break;
  }
}

console.log(`[Seed Tool - Middleware] Environment: '${activeEnv.toUpperCase()}' | Loaded: ${loadedEnvPath || 'None'}`);

const { Tenant, Bot, Analytics, User, RolePermission } = require('./models');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/isochat';

const sampleDailyActivity = (days = 14) => {
  const activity = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 0.4 : 1.0;
    const conversations = Math.floor((40 + Math.random() * 30) * baseMultiplier);
    const messages = Math.floor(conversations * (4 + Math.random() * 3));
    activity.push({ date: dateStr, conversations, messages });
  }
  return activity;
};

async function seed() {
  try {
    const safeUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    console.log(`Connecting to MongoDB at ${safeUri}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    await Tenant.deleteMany({});
    await Bot.deleteMany({});
    await Analytics.deleteMany({});
    await User.deleteMany({});
    await RolePermission.deleteMany({});
    console.log('Cleared existing data.');

    // 1. Tenants
    const tenants = await Tenant.insertMany([
      { name: 'Acme Enterprise', code: 'acme' },
      { name: 'Globex Corp', code: 'globex' },
      { name: 'Initech Software', code: 'initech' }
    ]);
    console.log(`Seeded ${tenants.length} tenants.`);

    // 2. Bots
    const bots = await Bot.insertMany([
      {
        tenantId: tenants[0]._id,
        name: 'Acme Support Desk',
        code: 'acme-support',
        description: 'Primary customer support agent for Acme Enterprise services.',
        model: 'gpt-4-turbo',
        temperature: 0.3,
        systemPrompt: 'You are Acme Support Desk, a helpful, polite customer support agent.',
        status: 'active',
        greetingMessage: ['Hi! I’m Acme Support Desk. How can I help with your account or order today?'],
        quickReplies: ['Track Order', 'Return Policy', 'Contact Human Agent', 'Billing Help'],
        botUIConfigs: { botThemeColor: '#00306D', botHeaderText: 'Acme Support Desk' }
      },
      {
        tenantId: tenants[0]._id,
        name: 'Acme Lead Gen',
        code: 'acme-lead-gen',
        description: 'Conversational marketing agent running on product pages.',
        model: 'claude-3-5-sonnet',
        temperature: 0.8,
        systemPrompt: 'You are Acme Lead Gen. Assist website visitors and suggest relevant plans.',
        status: 'active',
        greetingMessage: ['Welcome! Explore our solutions and see what fits your business best.'],
        quickReplies: ['Product Overview', 'Pricing Plans', 'Schedule a Demo'],
        botUIConfigs: { botThemeColor: '#0F766E', botHeaderText: 'Acme Advisory' }
      },
      {
        tenantId: tenants[1]._id,
        name: 'Globex IT Assistant',
        code: 'globex-it',
        description: 'Internal IT helpdesk support bot for company employees.',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        systemPrompt: 'You are Globex IT Assistant. Help troubleshoot VPN, WiFi, and password issues.',
        status: 'active',
        greetingMessage: ['Hello Globex team member! What technical issue can I help solve?'],
        quickReplies: ['VPN Setup', 'Password Reset', 'WiFi Credentials', 'Open IT Ticket'],
        botUIConfigs: { botThemeColor: '#7C3AED', botHeaderText: 'Globex IT Helpdesk' }
      }
    ]);
    console.log(`Seeded ${bots.length} chatbots.`);

    // 3. Analytics
    for (const bot of bots) {
      const daily = sampleDailyActivity(14);
      const totalConvs = daily.reduce((s, d) => s + d.conversations, 0);
      const totalMsgs = daily.reduce((s, d) => s + d.messages, 0);

      await Analytics.create({
        botId: bot._id,
        summary: {
          totalConversations: totalConvs,
          totalMessages: totalMsgs,
          avgResponseTime: 420,
          userSatisfaction: 94,
          activeUsers: Math.floor(totalConvs * 0.85)
        },
        tokenUsage: { promptTokens: totalMsgs * 450, completionTokens: totalMsgs * 180 },
        dailyActivity: daily,
        topQueries: [
          { query: 'How do I reset my password?', count: 124, sentiment: 'neutral' },
          { query: 'Your service is incredibly fast, thank you!', count: 88, sentiment: 'positive' }
        ]
      });
    }
    console.log(`Seeded Analytics records.`);

    // 4. Role Permissions
    await RolePermission.insertMany([
      { tenantId: tenants[0]._id, roleName: 'Acme Administrator', allowedMenus: ['overview', 'ingestion', 'analytics'] },
      { tenantId: tenants[0]._id, roleName: 'Acme Analyst', allowedMenus: ['analytics'] },
      { tenantId: tenants[1]._id, roleName: 'Globex IT Operator', allowedMenus: ['overview', 'ingestion'] }
    ]);
    console.log('Seeded Role Permissions.');

    // 5. Users
    await User.insertMany([
      { username: 'admin', password: 'admin123', role: 'Super Admin', tenantId: null, fullName: 'Super Administrator', email: 'admin@isomorphic.com' },
      { username: 'acmeadmin', password: 'acme123', role: 'Acme Administrator', tenantId: tenants[0]._id, fullName: 'Acme Admin User', email: 'admin@acme.com' },
      { username: 'globexoperator', password: 'globex123', role: 'Globex IT Operator', tenantId: tenants[1]._id, fullName: 'Globex Operator', email: 'operator@globex.org' }
    ]);
    console.log('Seeded User accounts.');

    console.log('Database seeding successfully finished!');
  } catch (error) {
    console.error('Error during database seed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
