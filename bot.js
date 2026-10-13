require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  EmbedBuilder 
} = require('discord.js');
const db = require('./database');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const OWNER_ID = process.env.DISCORD_OWNER_ID; // Discord User ID cua Owner

if (!TOKEN || !CLIENT_ID) {
  console.log('[BOT] Chua cau hinh DISCORD_BOT_TOKEN hoac DISCORD_CLIENT_ID trong .env. Bot tam tat.');
  console.log('[BOT] Hay dien thong tin vao file .env de bat Bot.');
  process.exit(0);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Definition of Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('genkey')
    .setDescription('[OWNER ONLY] Tao key ban quyen moi')
    .addIntegerOption(opt => 
      opt.setName('hours')
         .setDescription('Thoi han (gio). Nhap -1 neu muon key Vinh vien (Lifetime)')
         .setRequired(true)
    )
    .addStringOption(opt => 
      opt.setName('note')
         .setDescription('Ghi chu (Vi du: Ban cho ai, Order ID...)')
         .setRequired(false)
    )
    .addStringOption(opt => 
      opt.setName('custom_key')
         .setDescription('Key tu dat theo y muon (neu khong dien bot se tu random)')
         .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('checkkey')
    .setDescription('Kiem tra thong tin va han su dung cua Key')
    .addStringOption(opt => 
      opt.setName('key')
         .setDescription('Key can kiem tra')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('resetkey')
    .setDescription('[OWNER ONLY] Reset HWID de key dang nhap tren may khac')
    .addStringOption(opt => 
      opt.setName('key')
         .setDescription('Key can reset HWID')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('delkey')
    .setDescription('[OWNER ONLY] Xoa key khoi he thong')
    .addStringOption(opt => 
      opt.setName('key')
         .setDescription('Key can xoa')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Xem thong ke he thong Key & Sessions')
].map(cmd => cmd.toJSON());

// Register Slash Commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('[BOT] Dang dang ky Slash Commands len Discord API...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('[BOT] Dang ky Slash Commands thanh cong!');
  } catch (err) {
    console.error('[BOT] Loi dang ky commands:', err);
  }
}

client.once('ready', () => {
  console.log(`[BOT] Bot da dang nhap thanh cong: ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;
  const isOwner = !OWNER_ID || user.id === OWNER_ID;

  // 1. /genkey
  if (commandName === 'genkey') {
    if (!isOwner) {
      return interaction.reply({ content: '❌ Ban khong phai Owner! Lenh nay chi danh cho Owner.', ephemeral: true });
    }

    const hours = interaction.options.getInteger('hours');
    const note = interaction.options.getString('note') || `Tao boi @${user.username}`;
    const customKey = interaction.options.getString('custom_key');

    const keyStr = customKey ? customKey.trim() : ('VIP-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase());

    const created = db.createKey({
      key: keyStr,
      durationHours: hours,
      note,
      createdBy: `discord:${user.id}`
    });

    const expText = hours === -1 ? '♾️ Vĩnh viễn (Lifetime)' : `${hours} giờ (Hết hạn: <t:${Math.floor(created.expiresAt / 1000)}:R>)`;

    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🔑 ĐÃ TẠO KEY THÀNH CÔNG')
      .setDescription(`\`\`\`${created.key}\`\`\``)
      .addFields(
        { name: '⏳ Thời hạn', value: expText, inline: true },
        { name: '📝 Ghi chú', value: note, inline: true },
        { name: '🔒 HWID', value: 'Chưa khóa (Khóa tự động khi nhập lần đầu)', inline: false }
      )
      .setFooter({ text: 'BR.Mods Auth Management' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 2. /checkkey
  if (commandName === 'checkkey') {
    const keyStr = interaction.options.getString('key').trim();
    const k = db.getKey(keyStr);

    if (!k) {
      return interaction.reply({ content: `❌ Không tìm thấy key \`${keyStr}\` trong hệ thống!`, ephemeral: true });
    }

    const now = Date.now();
    const isExpired = k.expiresAt && now > k.expiresAt;
    const statusText = !k.active ? '⛔ Đã vô hiệu hóa' : (isExpired ? '⌛ Đã hết hạn' : '✅ Đang hoạt động');

    const expText = !k.expiresAt ? '♾️ Vĩnh viễn' : (isExpired ? `Đã hết hạn lúc <t:${Math.floor(k.expiresAt / 1000)}:f>` : `<t:${Math.floor(k.expiresAt / 1000)}:R>`);

    const embed = new EmbedBuilder()
      .setColor(isExpired || !k.active ? 0xFF4500 : 0x00BFFF)
      .setTitle('🔍 THÔNG TIN KEY')
      .addFields(
        { name: 'Key', value: `\`${k.key}\``, inline: false },
        { name: 'Trạng thái', value: statusText, inline: true },
        { name: 'Hết hạn', value: expText, inline: true },
        { name: 'HWID Lock', value: k.hwid ? `\`${k.hwid}\`` : 'Chưa gắn thiết bị', inline: false },
        { name: 'Ghi chú', value: k.note || 'Không có', inline: true }
      )
      .setFooter({ text: 'BR.Mods License Validator' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 3. /resetkey
  if (commandName === 'resetkey') {
    if (!isOwner) {
      return interaction.reply({ content: '❌ Chỉ Owner mới có quyền Reset HWID!', ephemeral: true });
    }

    const keyStr = interaction.options.getString('key').trim();
    const ok = db.resetHwid(keyStr);

    if (ok) {
      return interaction.reply({ content: `✅ Đã reset HWID cho key \`${keyStr}\` thành công! Người dùng có thể đăng nhập trên máy mới.`, ephemeral: true });
    } else {
      return interaction.reply({ content: `❌ Không tìm thấy key \`${keyStr}\`!`, ephemeral: true });
    }
  }

  // 4. /delkey
  if (commandName === 'delkey') {
    if (!isOwner) {
      return interaction.reply({ content: '❌ Chỉ Owner mới có quyền Xóa key!', ephemeral: true });
    }

    const keyStr = interaction.options.getString('key').trim();
    const ok = db.deleteKey(keyStr);

    if (ok) {
      return interaction.reply({ content: `🗑️ Đã xóa vĩnh viễn key \`${keyStr}\` khỏi hệ thống!`, ephemeral: true });
    } else {
      return interaction.reply({ content: `❌ Không tìm thấy key \`${keyStr}\`!`, ephemeral: true });
    }
  }

  // 5. /stats
  if (commandName === 'stats') {
    const keys = db.listKeys();
    const now = Date.now();
    const activeCount = keys.filter(k => k.active && (!k.expiresAt || k.expiresAt > now)).length;
    const expiredCount = keys.filter(k => k.expiresAt && k.expiresAt <= now).length;
    const hwidBoundCount = keys.filter(k => !!k.hwid).length;

    const embed = new EmbedBuilder()
      .setColor(0x9932CC)
      .setTitle('📊 THỐNG KÊ HỆ THỐNG KEY')
      .addFields(
        { name: '🔑 Tổng số Key', value: `${keys.length}`, inline: true },
        { name: '🟢 Đang hoạt động', value: `${activeCount}`, inline: true },
        { name: '🔴 Đã hết hạn', value: `${expiredCount}`, inline: true },
        { name: '💻 Đã khóa HWID', value: `${hwidBoundCount}`, inline: true }
      )
      .setFooter({ text: 'BR.Mods System Dashboard' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
