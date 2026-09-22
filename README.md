<div align="center">

# 🎓 Assistant Headman For PSK

**Юзерскрипт для автоматизации работы с проговарами на сайте** `[system.fgoupsk.ru](https://system.fgoupsk.ru)`

</div>

---

## ✨ Возможности

| | Функция | Описание |
|---|---|---|
| 📅 | **Два режима работы** | «Один день» (текущий день + календарь навигации) и «Несколько дней» (диапазон дат с быстрыми кнопками «Сегодня / Неделя / Месяц») |
| 👥 | **Массовая отметка прогулов** | Выставление отсутствий сразу у нескольких студентов за выбранные пары/часы |
| ❌ | **Удаление часов** | Снятие ранее выставленных прогулов тем же способом |
| 🧮 | **Счётчик прогулов** | Live-подсчёт студентов с прогулом (обновляется через `MutationObserver`) |
| 📆 | **Календарь дня** | Навигация по месяцам, переход к предыдущему/следующему дню и «Сегодня» одним кликом |
| 📊 | **Режим «Несколько дней»** | Выбор диапазона дат (С/По), быстрые кнопки, подсчёт дней. Скрипт загружает страницу за каждый день диапазона и массово выставляет/удаляет прогулы |
| 🌓 | **Синхронизация темы** | Светлая/тёмная тема подхватывается от дополнения PskStyle, классов сайта или системной схемы |
| 💾 | **Память ввода** | Студенты, пары, причина и режим сохраняются в `localStorage` между сессиями |
| ⏹ | **Стоп / отмена** | Остановка пакетной операции в любой момент + отмена автообновления страницы |
| 🔄 | **Без перезагрузки** | Ячейки таблицы обновляются на лету после успешных запросов (в режиме «Один день») |

---

## 📥 Установка

### Шаг 1 — установите менеджер юзерскриптов

Выберите **одно** расширение под свой браузер:

#### Tampermonkey *(рекомендуется)*

| Браузер | Ссылка |
|---|---|
| 🌐 Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| 🦊 Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| 🧭 Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| 🅾 Opera | [Opera Addons](https://addons.opera.com/extensions/details/tampermonkey/) |
| 🍎 Safari | [App Store](https://apps.apple.com/app/tampermonkey/id1482490089) |

> 💡 На **Firefox для Android** тоже работает — берите из [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/).
> Для Safari также есть отличные альтернативы: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) (бесплатный, open-source) и [Stay](https://apps.apple.com/app/stay-for-safari/id1592417160).

#### Violentmonkey

| Браузер | Ссылка |
|---|---|
| 🌐 Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) |
| 🦊 Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/violentmonkey/) |
| 🧭 Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenkkddmbclomhiblgggliao) |

> Violentmonkey — полностью бесплатный и open-source: [GitHub](https://github.com/violentmonkey/violentmonkey) · [Сайт](https://violentmonkey.github.io/)

<details>
<summary><b>Другие менеджеры</b></summary>

- **Greasemonkey** (Firefox) — [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/greasemonkey/)

</details>

---

### Шаг 2 — установите скрипт

**Способ 1 — через Greasy Fork (одна кнопка)**

[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-%23FF5F00?style=for-the-badge&logo=firefox&logoColor=white)](https://greasyfork.org/ru/scripts/592821-ah-assistant-headman)

Просто нажмите кнопку **Use this script** на странице Greasy Fork и скрипт установится автоматически.

**Способ 2 — одна ссылка (Tampermonkey/Violentmonkey)**

Откройте сырую ссылку на скрипт:

```
https://github.com/ApollieKastro/Assistant-Headman-For-PSK/raw/main/AH.js
```

Tampermonkey перехватит файл и предложит установку. Либо создайте новый скрипт вручную и вставьте содержимое `AH.js`.

**Способ 3 — вручную (копипаст)**

1. Откройте панель расширения → **«Создать новый скрипт»**
2. Удалите шаблон, вставьте всё содержимое файла [`AH.js`](AH.js)
3. Сохраните — `Ctrl + S` (или `Cmd + S` на Mac)

---

### Шаг 3 — проверьте

Откройте [system.fgoupsk.ru](https://system.fgoupsk.ru/student/?mode=ucheba&act=group&act2=prog*) — интерфейс должен преобразиться. Внизу боковой панели появится плавающая панель с Controls.

> ⚠️ Если ничего не произошло — обновите страницу `Ctrl + F5` и убедитесь, что скрипт включён в панели расширения.

---

## 🎛 Использование

Скрипт активен на странице прогулов группы:

```
https://system.fgoupsk.ru/student/?mode=ucheba&act=group&act2=prog*
```

### Формат ввода

| Поле | Примеры | Описание |
|------|---------|----------|
| Студенты | `0`, `все`, `*` | все студенты списка |
| | `1-10` | диапазон по порядковым номерам |
| | `1,3,7` | конкретные номера |
| Пары/часы | `0` | все пары/часы в дне |
| | `1` | вся первая пара |
| | `1.1` | первая пара, первый час |
| | `1-4` | пары с первой по четвёртую |

### Режим «Несколько дней»

Переключите панель на вкладку **📅 Несколько дней**:

- **С / По** — выберите диапазон дат через поля с календарём.
- **Быстрые кнопки** — «Сегодня» (один день), «Неделя» (пн–вс текущей недели), «Месяц» (весь текущий месяц).
- Введите студентов, пары и причину — аналогично режиму «Один день».
- Нажмите «✅ Выставить прогулы» или «❌ Удалить часы» — скрипт загрузит страницу за каждый день и выполнит операции.
- Максимальный диапазон — 31 день.

Нераспознанные токены подсвечиваются в отчёте — скрипт не выполнит операцию вслепую.

### Причины отсутствия

`нет` · `мед.справка` · `общественная деятельность` · `дежурство` · `объяснительная`

### Панель

- Режимы переключаются вкладками **📅 Один день** / **📅 Несколько дней** (выбор запоминается).
- Сворачивается кнопкой `–` (состояние запоминается).
- На широких экранах «плавает» справа от таблицы при прокрутке, на узких (<700px) — обычным блоком под таблицей.
- Скрывается при печати страницы.
- Опция «Автообновление» перезагружает страницу через 3 секунды после успешной операции (с кнопкой отмены).

---

## 🛠 Совместимость

- Работает только на страницах прогулов системы ФГБОУ ПСК (`system.fgoupsk.ru`).
- Требует разрешения `GM_xmlhttpRequest` (Tampermonkey / Violentmonkey).
- Дружит с [PskStyle](https://github.com/AbrikosV/Pskstyle) — наследует его тему оформления.

---

## Автор

**AbrikosV**

---

<div align="center">

**[⬆ Установить сейчас](#-установка)** · Made with ❤️ by **AbrikosV**

📄 Лицензия [GPL-3.0](LICENSE)

</div>