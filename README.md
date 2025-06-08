# Logic View — Truth Table Generator

**Logic View** is a web-based tool for propositional logic. It generates complete truth tables for any formula and classifies it as a tautology, contradiction, or contingency.

## 🌟 Features

- **Interactive Input** for logic expressions (e.g., `P → Q ∨ ¬R`)
- **Supported Operators:**  
  - AND: `&` or `∧`
  - OR: `|` or `∨`
  - NOT: `~` or `¬`
  - IMPLIES: `->` or `→`
  - BICONDITIONAL: `<->` or `↔`
- **Dynamic Truth Table** generation
- **Automatic Classification:**  
  - Tautology (always true)
  - Contradiction (always false)
  - Contingency (sometimes true, sometimes false)
- **Colorful Responsive UI**
- **Error Handling** for invalid input
- **Copy-paste support** for logic symbols
- **Hover tooltips** for logic types

## 🚀 Usage

1. **Open `index.html` in your browser.**
2. **Enter** a logic expression, e.g., `P → Q ∨ ¬R`
3. **Click "Generate Truth Table"**
4. View the **truth table** and **classification** below.

## 📦 Project Structure

```
LogicView/
├── index.html      # Main UI
├── styles.css      # Styling for UI and tables
├── script.js       # Logic parser, table generator, classification
└── README.md       # This documentation
```

## 📚 Examples

- `P ∧ Q`
- `P → Q`
- `P → (Q ∨ ¬R)`
- `(P ↔ Q) ∧ (¬R ∨ Q)`

## 🛠️ Notes

- **Variables**: Use letters like `P`, `Q`, `R`, `A`, `B`, etc.
- **Parentheses**: Use `(` and `)` for grouping.
- **Errors**: Clear, user-friendly messages are shown for invalid syntax.

## 🧠 Enhancements

- Color-coded truth values
- Copy-paste for logic symbols
- Tooltips for logic types

---

**Made with ❤️ for students & logic enthusiasts.**