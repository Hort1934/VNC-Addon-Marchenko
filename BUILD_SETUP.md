# Інструкції для встановлення Visual Studio Build Tools

## Швидке розв'язання

### Варіант 1: Visual Studio Community (Рекомендований)

1. Відкрийте Visual Studio Installer
2. Натисніть "Modify" для Visual Studio Community 2022
3. Переконайтеся, що встановлені наступні компоненти:

**Обов'язкові компоненти:**
- ✅ **Desktop development with C++** (робочий процес)
- ✅ **MSVC v143 - VS 2022 C++ x64/x86 build tools** (latest)
- ✅ **Windows 11 SDK** (10.0.22000.0 або новіша)
- ✅ **CMake tools for Visual Studio**

### Варіант 2: Build Tools Only

Якщо ви не хочете повну Visual Studio, завантажте тільки Build Tools:

```bash
# Завантажити та встановити Build Tools
https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Або через winget
winget install Microsoft.VisualStudio.2022.BuildTools
```

### Варіант 3: Тимчасове рішення (для тестування)

Якщо ви хочете швидко протестувати проект без встановлення Visual Studio:

```bash
# Встановити windows-build-tools (може не працювати з Node.js 23)
npm install -g windows-build-tools

# АБО використати старішу версію Node.js
nvm install 20.10.0
nvm use 20.10.0
```

## Після встановлення компонентів

1. Перезапустіть PowerShell/Command Prompt
2. Переконайтеся, що змінні середовища налаштовані:

```bash
# Перевірка
echo $env:VCInstallDir
echo $env:WindowsSDKDir
```

3. Спробуйте знову:

```bash
npm run clean
npm install
```