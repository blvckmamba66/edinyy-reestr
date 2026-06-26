// Единый список строительных специальностей.
// Используется и на странице регистрации, и в админ-панели.
window.SPECIALTIES = [
  'Арматурщик',
  'Бетонщик',
  'Бригадир',
  'Геодезист',
  'Главный инженер проекта (ГИП)',
  'Жестянщик',
  'Изолировщик',
  'Инженер по гражданской обороне и ЧС',
  'Инженер по пожарной безопасности',
  'Инженер по охране труда',
  'Инженер по строительному контролю (качеству)',
  'Инженер ПТО',
  'Маляр-штукатур',
  'Мастер строительный (участка)',
  'Монтажник',
  'Монолитчик',
  'Начальник участка',
  'Облицовщик-плиточник',
  'Прораб',
  'Разнорабочий',
  'Сантехник',
  'Сварщик',
  'Сметчик',
  'Специалист по промышленной безопасности',
  'Специалист по экологической безопасности',
  'Столяр-плотник',
  'Техник-строитель',
  'Электромонтажник'
];

// Значение пункта «Другое» (свой вариант)
window.SPECIALTY_OTHER = '__other__';

// Наполняет <select> опциями специальностей. otherLabel — текст пункта «Другое».
window.fillSpecialtyOptions = function (selectEl, { includeOther = true, placeholder = '— выберите —' } = {}) {
  selectEl.innerHTML = '';
  if (placeholder !== null) {
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    selectEl.appendChild(ph);
  }
  for (const name of window.SPECIALTIES) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }
  if (includeOther) {
    const opt = document.createElement('option');
    opt.value = window.SPECIALTY_OTHER;
    opt.textContent = 'Другое';
    selectEl.appendChild(opt);
  }
};
