import matplotlib.pyplot as plt

labels = ['HIT', 'MISS']
xs = 99.26
vals = [xs, 100 - xs]

colors = ['#27AE60', '#C0392B']
explode = [0.04, 0.08]

fig, ax = plt.subplots(figsize=(8, 6))

ax.set_title('', pad=20)

wedges, texts, autotexts = ax.pie(
    vals,
    labels=labels,
    colors=colors,
    explode=explode,
    autopct=lambda p: f'{p:.2f}%' if p >= 1 else '',   # ẩn 0.74%
    startangle=90,
    counterclock=False,
    pctdistance=0.7,
    labeldistance=1.05,
    wedgeprops=dict(edgecolor='white', linewidth=2),
    textprops=dict(fontsize=12)
)

for t in texts:
    t.set_fontweight('bold')

for t in autotexts:
    t.set_color('white')
    t.set_fontsize(11)
    t.set_fontweight('bold')

ax.axis('equal')
plt.legend(fontsize=14)
plt.tight_layout()
plt.show()