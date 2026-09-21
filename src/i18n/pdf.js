export const LOCALE_MAP = {
  uk: 'uk-UA',
  en: 'en-US',
  pl: 'pl-PL',
  ru: 'ru-RU',
  cs: 'cs-CZ',
}

const STRINGS = {
  en: {
    title: 'Sanjo Report',
    monthlySummary: 'Monthly Summary:',
    detailedRecords: 'Detailed Records:',
    date: 'Date:',
    siteId: 'Site ID:',
    workers: 'Workers:',
    hours: 'Hours:',
    tasks: 'Tasks:',
    materials: 'Materials:',
    hoursUnit: 'hrs',
    recordsWord: (n) => (n === 1 ? 'record' : 'records'),
  },
  uk: {
    title: 'Звіт Sanjo',
    monthlySummary: 'Зведення по місяцях:',
    detailedRecords: 'Детальні записи:',
    date: 'Дата:',
    siteId: "Об'єкт ID:",
    workers: 'Працівники:',
    hours: 'Години:',
    tasks: 'Завдання:',
    materials: 'Матеріали:',
    hoursUnit: 'год',
    recordsWord: (n) => {
      const mod10 = n % 10
      const mod100 = n % 100
      if (mod10 === 1 && mod100 !== 11) return 'запис'
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'записи'
      return 'записів'
    },
  },
  pl: {
    title: 'Raport Sanjo',
    monthlySummary: 'Podsumowanie miesięczne:',
    detailedRecords: 'Szczegółowe wpisy:',
    date: 'Data:',
    siteId: 'ID budowy:',
    workers: 'Pracownicy:',
    hours: 'Godziny:',
    tasks: 'Zadania:',
    materials: 'Materiały:',
    hoursUnit: 'godz.',
    recordsWord: (n) => {
      const mod10 = n % 10
      const mod100 = n % 100
      if (n === 1) return 'wpis'
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'wpisy'
      return 'wpisów'
    },
  },
  ru: {
    title: 'Отчёт Sanjo',
    monthlySummary: 'Сводка по месяцам:',
    detailedRecords: 'Подробные записи:',
    date: 'Дата:',
    siteId: 'ID объекта:',
    workers: 'Рабочие:',
    hours: 'Часы:',
    tasks: 'Задачи:',
    materials: 'Материалы:',
    hoursUnit: 'ч',
    recordsWord: (n) => {
      const mod10 = n % 10
      const mod100 = n % 100
      if (mod10 === 1 && mod100 !== 11) return 'запись'
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'записи'
      return 'записей'
    },
  },
  cs: {
    title: 'Report Sanjo',
    monthlySummary: 'Měsíční souhrn:',
    detailedRecords: 'Podrobné záznamy:',
    date: 'Datum:',
    siteId: 'ID stavby:',
    workers: 'Pracovníci:',
    hours: 'Hodiny:',
    tasks: 'Úkoly:',
    materials: 'Materiály:',
    hoursUnit: 'hod',
    recordsWord: (n) => {
      if (n === 1) return 'záznam'
      if (n >= 2 && n <= 4) return 'záznamy'
      return 'záznamů'
    },
  },
}

export const getPdfStrings = (lang) => STRINGS[lang] || STRINGS.uk
