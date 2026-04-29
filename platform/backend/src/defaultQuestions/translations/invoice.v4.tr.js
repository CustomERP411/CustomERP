// Turkish prompt + option label translations for invoice.v4 questions.
module.exports = {
  prompts: {
    invoice_currency: 'Faturalarda hangi para birimini kullanıyorsunuz?',
    invoice_tax_rate: 'Standart vergi oranınız nedir (%)?',
    invoice_enable_payments:
      'Müşteri ödemelerini kaydedip her faturada kalan borcu görmek ister misiniz?',
    invoice_enable_notes:
      'Faturayı kestikten sonra düzeltmek için bazen alacak ya da ek borç çıkarmanız gerekiyor mu?',
    invoice_enable_calc_engine: 'Bir faturanın her satırında iskonto veya ek ücret olabiliyor mu?',
    invoice_payment_terms: 'Müşterileriniz genellikle ne zaman ödeme yapıyor?',
    invoice_recurring: 'Aynı faturayı her ay aynı müşteriye kesiyor musunuz (ör. abonelik, kira, aidat)?',
    invoice_print: 'Faturaları PDF olarak yazdırmak veya indirmek ister misiniz?',
    invoice_stock_link: 'Stoklu bir ürünü faturalarken stoğu da aynı anda düşürelim mi?',
    invoice_ap_link:
      'Tedarikçiden mal teslim alındığında otomatik olarak tedarikçi faturası taslağı oluşturalım mı?',
    invoice_payment_methods: 'Müşterileriniz hangi ödeme yöntemlerini kullanıyor?',
  },
  optionLabels: {
    invoice_payment_terms: {
      Immediately: 'Hemen',
      'Within 15 days': '15 gün içinde',
      'Within 30 days': '30 gün içinde',
      'Within 60 days': '60 gün içinde',
    },
    invoice_payment_methods: {
      Cash: 'Nakit',
      'Credit Card': 'Kredi Kartı',
      'Debit Card': 'Banka Kartı',
      'Bank Transfer': 'Havale/EFT',
      Other: 'Diğer',
    },
  },
};
