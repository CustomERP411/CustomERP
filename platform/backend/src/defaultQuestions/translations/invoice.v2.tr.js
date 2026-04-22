// Turkish prompt + option label translations for invoice.v2 questions.
module.exports = {
  prompts: {
    invoice_currency: 'Faturalarda hangi para birimini kullanıyorsunuz?',
    invoice_tax_rate: 'Standart vergi oranınız nedir (%)?',
    invoice_enable_payments: 'Faturalara ödeme kaydedip kalan borcu takip etmek ister misiniz?',
    invoice_enable_notes: 'Gönderilmiş faturaları düzeltmek için alacak veya borç dekontlarına ihtiyacınız var mı?',
    invoice_enable_calc_engine: 'Fatura satırlarında satır bazlı iskonto ve ek ücret olsun ister misiniz?',
    invoice_payment_terms: 'Müşterileriniz genellikle ne zaman ödeme yapıyor?',
    invoice_recurring: 'Aynı faturayı her ay aynı müşteriye kesiyor musunuz (ör. abonelik, kira, aidat)?',
    invoice_print: 'Faturaları PDF olarak yazdırmak veya indirmek ister misiniz?',
  },
  optionLabels: {
    invoice_payment_terms: {
      Immediately: 'Hemen',
      'Within 15 days': '15 gün içinde',
      'Within 30 days': '30 gün içinde',
      'Within 60 days': '60 gün içinde',
    },
  },
};
