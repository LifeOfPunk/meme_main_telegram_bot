import { UserService } from './src/services/User.service.js';

const us = new UserService();
await us.updateUser(1916527652, { paid_quota: 1, free_quota: 0 });
console.log('✅ User 1916527652 balance fixed: paid_quota=1, free_quota=0');
process.exit(0);
