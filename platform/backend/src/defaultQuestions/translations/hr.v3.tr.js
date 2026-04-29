// Turkish prompt + option label translations for hr.v3 questions.
// Keys, slugs, option VALUES, and SDF mappings stay identical across locales — we
// only translate user-facing text. The registry falls back to English for any
// key not present here.
module.exports = {
  prompts: {
    hr_work_days: 'Şirketiniz hangi günlerde çalışıyor?',
    hr_daily_hours: 'Normal bir iş günü kaç saat?',
    hr_enable_leave_engine: 'Kim izinde, herkesin kaç günü kaldı; bunu takip edelim mi?',
    hr_enable_leave_approvals: 'İzin talepleri sayılmadan önce bir yönetici onaylasın mı?',
    hr_enable_attendance_time:
      'Giriş/çıkış (ya da günlük saat) tutalım da kim ne kadar çalıştı bilelim mi?',
    hr_enable_compensation_ledger:
      'Maaş, ek ödeme ve kesintileri tek yerde tutup bordroya hazır gitmek ister misiniz?',
    hr_leave_types: 'Çalışanlarınız hangi izin türlerini kullanıyor?',
    hr_leave_attendance_link:
      'İzin onaylandığında o günleri puantajda otomatik olarak "yokta" işaretleyelim mi?',
    hr_leave_payroll_link: 'Ücretsiz izin günleri o ayın bordrosundan otomatik düşülsün mü?',
    hr_timesheet_payroll_link: 'Puantajdaki fazla mesai saatleri bordroya otomatik yansısın mı?',
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
