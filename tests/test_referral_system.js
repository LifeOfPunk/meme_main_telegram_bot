import 'dotenv/config';
import { ReferralService } from './src/services/Referral.service.js';
import { UserService } from './src/services/User.service.js';

const referralService = new ReferralService();
const userService = new UserService();

async function testReferralSystem() {
    console.log('🧪 Testing Referral System\n');
    
    // Test 1: Get referral stats
    console.log('Test 1: Get referral stats for user 1323534384');
    const stats = await referralService.getReferralStats(1323534384);
    console.log('Stats:', stats);
    console.log('');
    
    // Test 2: Check if user is expert
    console.log('Test 2: Check if user 1323534384 is expert');
    const user = await userService.getUser(1323534384);
    console.log('User isExpert:', user?.isExpert || false);
    console.log('');
    
    // Test 3: Get all experts
    console.log('Test 3: Get all experts');
    const experts = await referralService.getAllExperts();
    console.log('Total experts:', experts.length);
    console.log('Experts:', experts);
    console.log('');
    
    // Test 4: Check referral link generation
    console.log('Test 4: Referral links');
    const botName = process.env.BOT_NAME || 'meemee_bot';
    const userId = 1323534384;
    const userRefLink = `https://t.me/${botName}?start=ref_${userId}`;
    const expertRefLink = `https://t.me/${botName}?start=expert_${userId}`;
    console.log('User referral link:', userRefLink);
    console.log('Expert referral link:', expertRefLink);
    
    process.exit(0);
}

testReferralSystem().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
