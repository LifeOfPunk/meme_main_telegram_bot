#!/bin/bash
# Исправление ошибки в bot_start.js

sed -i '140,155s/await ctx\.reply(`❌ Произошла ошибка номер ${errorData\.id}\. Обратитесь к менеджеру @aiviral_manager с номером ошибки\.`);/if (ctx \&\& ctx.reply) {\n            try {\n                await ctx.reply(`❌ Произошла ошибка номер ${errorData.id}. Обратитесь к менеджеру @aiviral_manager с номером ошибки.`);\n            } catch (replyErr) {\n                console.error("❌ Failed to send error message:", replyErr.message);\n            }\n        }/' src/bot_start.js

echo "✅ bot_start.js исправлен"
