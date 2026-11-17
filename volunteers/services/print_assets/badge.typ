#set page(width: 90mm, height: 60mm, margin: 7mm)
#set text(font: "Noto Sans", size: 14pt)

#render-each(data, it => align(center + horizon)[
  #text(size: 20pt, weight: "bold", full-name(it.user))
  #parbreak()
  #it.position.name
  #if it.hall != none [#linebreak() #it.hall.name]
])
