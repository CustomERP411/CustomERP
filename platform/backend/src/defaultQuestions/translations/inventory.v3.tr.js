// Turkish prompt + option label translations for inventory.v3 questions.
module.exports = {
  prompts: {
    inv_multi_location: 'Stokunuzu birden fazla yerde (depo, mağaza, raf) mı tutuyorsunuz?',
    inv_allow_negative_stock: 'Stok bittiğinde sistem yine de stok çıkışına izin versin mi?',
    inv_enable_reservations: 'Siparişi onaylamadan önce stok rezervasyonu yapmak ister misiniz?',
    inv_enable_inbound: 'Tedarikçilerden alım yapıp sipariş verilen ile teslim alınanı karşılaştırmak ister misiniz?',
    inv_enable_cycle_counting: 'Sistemin gerçek stokla uyumunu kontrol etmek için sayım yapmak ister misiniz?',
    inv_batch_tracking: 'Ürünlerin izlenebilirliğini nasıl takip ediyorsunuz? (gıda, ilaç, kimyasal için yaygın)',
    inv_serial_tracking: 'Ürünleri seri numarası ile ayrı ayrı takip ediyor musunuz? (elektronik, ekipman için yaygın)',
    inv_expiry_tracking: 'Ürünlerinizin son kullanma tarihi var mı?',
    inv_low_stock_alerts: 'Stok azaldığında uyarılmak ister misiniz?',
    inv_costing_method: 'Stok maliyetini nasıl hesaplamak istiyorsunuz?',
    inv_qr_labels: 'Ürünleriniz için QR kod etiketi yazdırmak ister misiniz?',
  },
  optionLabels: {
    inv_batch_tracking: {
      'No traceability tracking': 'İzlenebilirlik takibi yok',
      'Batch number': 'Parti numarası',
      'Lot number': 'Lot numarası',
      'Both batch and lot': 'Parti ve lot birlikte',
    },
    inv_costing_method: {
      'FIFO (first items in are first out)': 'FIFO (ilk giren ilk çıkar)',
      'Weighted Average (average cost of all items)': 'Ağırlıklı Ortalama (tüm kalemlerin ortalama maliyeti)',
      'No costing needed': 'Maliyetlendirme gerekmiyor',
    },
  },
};
