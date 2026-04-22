// Turkish prompt + option label translations for hr.v2 questions.
// Keys, slugs, option VALUES, and SDF mappings stay identical across locales — we
// only translate user-facing text. The registry falls back to English for any
// key not present here.
module.exports = {
  prompts: {
    hr_work_days: 'Şirketiniz hangi günlerde çalışıyor?',
    hr_daily_hours: 'Normal bir iş günü kaç saat?',
    hr_enable_leave_engine: 'Her çalışanın kalan izin günlerini takip etmek istiyor musunuz?',
    hr_enable_leave_approvals: 'Çalışan izin kullanmadan önce izin taleplerinin onaylanması gerekiyor mu?',
    hr_enable_attendance_time: 'Çalışanların giriş, çıkış ve çalıştıkları saatleri takip etmek istiyor musunuz?',
    hr_enable_compensation_ledger: 'Bordro hazırlığı için maaş, ek ödeme ve kesintileri kaydetmek ister misiniz?',
    hr_leave_types: 'Çalışanlarınız hangi izin türlerini kullanıyor?',
  },
  optionLabels: {
    hr_work_days: {
      Mon: 'Pzt',
      Tue: 'Sal',
      Wed: 'Çar',
      Thu: 'Per',
      Fri: 'Cum',
      Sat: 'Cmt',
      Sun: 'Paz',
    },
    hr_leave_types: {
      'Sick Leave': 'Hastalık İzni',
      'Vacation / Annual': 'Tatil / Yıllık İzin',
      'Unpaid Leave': 'Ücretsiz İzin',
      'Maternity / Paternity': 'Doğum / Babalık İzni',
      'Personal / Family': 'Kişisel / Aile İzni',
    },
  },
};
