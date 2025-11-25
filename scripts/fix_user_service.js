import fs from 'fs';

const file = 'src/services/User.service.js';
let content = fs.readFileSync(file, 'utf8');

// Находим и заменяем функцию addPaidQuota
const oldFunc = /async addPaidQuota\(userId, amount\) \{[^}]*user\.paid_quota \+ amount;[^}]*\}/s;
const newFunc = `async addPaidQuota(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return false;
        
        const currentQuota = user.paid_quota || 0;
        const newQuota = currentQuota + amount;
        
        await this.updateUser(userId, { 
            paid_quota: newQuota 
        });
        
        console.log(\`💳 User \${userId}: added \${amount} paid generations. Total: \${newQuota}\`);
        return true;
    }`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log('✅ User.service.js fixed');
