node call = string of letters + `(` + parameters joined by `,` + `)`

(special case: no letters = 'identity' node which just returns its sole input unchanged; useful for math expressions)

macro call = same as node call but using `[]` (name can't be empty)

reffed node = `#` + string of letters or numbers + `=` + node call or expression

node backref = `#` + string of letters or numbers + `#`

param = node call or macro call or number or expression

expression = math expression with `+-*/,` of parameters; can operate samplewise or controlwise as needed. comma operator `,` works like in JS, left is evaluated but discarded (it can be a node named or something)

first input of a node can be piped into using `|>` it comes before parameters

any amount of whitespace is allowed anywhere

comments are C style (`//` for line comments, `/*`...`*/` for block comments which CAN nest)

---

names can be abbreviated where it would be unambiguous as to what they refer to
