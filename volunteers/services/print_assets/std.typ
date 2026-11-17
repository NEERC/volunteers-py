#let full-name(user) = (
  user.last_name_ru,
  user.first_name_ru,
  user.patronymic_ru,
).filter(part => part != none and part != "").join(" ")

#let render-each(data, render) = {
  for (index, item) in data.enumerate() {
    if index > 0 { pagebreak() }
    render(item)
  }
}
