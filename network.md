node call = string of letters + `(` + parameters joined by `,` + `)`

parameters in node call can be named `name: value` to give params by name, follows python rules (no anonymous arguments after named arguments)

list = wrapped in `[]`

name def = name + `=` + definition

name ref = name on its own

enum constant = `.` + name

param = node call or macro call or number or expression

expression = math expression of parameters. comma operator `,` works like in JS, left is evaluated but discarded (it can be a node named or something)

pipe operator `|>` needs node on right, and passes value to first parameter (syntax transformation)

map pipe operator `*>` takes list and expression, and copies the expression for each element and passes it in like with `|>`

reduce pipe `+>` takes a list and returns the sum of the elements

any amount of whitespace is allowed anywhere

macro definition = node def + `:-` + body

template = `{`...`}` for quasiquote, `&`x for unquote

comments are C style (`//` for line comments, `/*`...`*/` for block comments which DO nest)

---

names can be abbreviated where it would be unambiguous as to what they refer to
