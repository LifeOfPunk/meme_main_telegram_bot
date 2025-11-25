import 'dotenv/config';
import { PaymentCryptoService } from './src/services/PaymentCrypto.service.js';

const paymentService = new PaymentCryptoService();

console.log('🧪 Testing crypto payment structure...\n');

// Тестируем создание платежа
const testPayment = async () => {
    try {
        const result = await paymentService.createPayment({
            userId: 123456789,
            amount: 6.2,
            payCurrency: 'USDT (SOL)',
            package: 'pack_10'
        });
        
        console.log('\n📦 FULL PAYMENT OBJECT:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n🔍 CHECKING FIELDS:');
        console.log('orderId:', result.orderId);
        console.log('output:', result.output);
        console.log('output.address:', result.output?.address);
        console.log('output.Address:', result.output?.Address);
        console.log('output.wallet:', result.output?.wallet);
        console.log('input.amount:', result.input?.amount);
        console.log('cryptoAmount:', result.cryptoAmount);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
};

testPayment();
