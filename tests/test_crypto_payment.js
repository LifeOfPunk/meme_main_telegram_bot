import 'dotenv/config';
import { PaymentCryptoService } from '../src/services/PaymentCrypto.service.js';

console.log('🧪 Testing Crypto Payment with 0xProcessing\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const paymentService = new PaymentCryptoService();

// Тестовые данные
const testPayment = {
    userId: 123456789,
    amount: 6.2, // $6.2 USD
    payCurrency: 'USDT (SOL)', // Solana USDT
    package: 'pack_10'
};

console.log('📋 Test Payment Details:');
console.log(`   User ID: ${testPayment.userId}`);
console.log(`   Amount: $${testPayment.amount} USD`);
console.log(`   Currency: ${testPayment.payCurrency}`);
console.log(`   Package: ${testPayment.package}`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🚀 Creating payment...\n');

try {
    const result = await paymentService.createPayment(testPayment);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (result.error) {
        console.log('❌ PAYMENT FAILED');
        console.log(`   Error: ${result.error}\n`);
        process.exit(1);
    }
    
    console.log('✅ PAYMENT CREATED SUCCESSFULLY!\n');
    console.log('📦 Order Details:');
    console.log(`   Order ID: ${result.orderId}`);
    console.log(`   User ID: ${result.userId}`);
    console.log(`   Package: ${result.package}`);
    console.log(`   Amount: $${result.amount} USD`);
    console.log(`   Currency: ${result.currency}\n`);
    
    console.log('💳 Payment Information:');
    if (result.output) {
        console.log(`   Wallet Address: ${result.output.address || result.output.Address || 'N/A'}`);
        console.log(`   Amount to Send: ${result.input?.amount || 'N/A'} ${result.currency}`);
        console.log(`   Destination Tag: ${result.output.destinationTag || result.output.DestinationTag || 'N/A'}`);
        console.log(`   Expires At: ${result.output.expiredAt || result.output.ExpiredAt || 'N/A'}`);
        console.log(`   Payment ID: ${result.output.paymentId || result.output.PaymentId || result.output.id || 'N/A'}\n`);
    } else {
        console.log('   ⚠️ No payment output data\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST PASSED - Payment can be created!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Проверяем что есть адрес кошелька
    const hasAddress = result.output && (result.output.address || result.output.Address);
    if (hasAddress) {
        console.log('✅ Wallet address is present - users will see it in Telegram!');
    } else {
        console.log('⚠️ WARNING: No wallet address in response!');
        console.log('   Users will NOT be able to pay!');
    }
    
    console.log('\n📝 Full Response:');
    console.log(JSON.stringify(result, null, 2));
    
} catch (error) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ TEST FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
}
