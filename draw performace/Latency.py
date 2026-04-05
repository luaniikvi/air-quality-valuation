import numpy as np
import matplotlib.pyplot as plt

# biểu đồ latencies
labels = np.array([
    "Server Processing",
    "Network",
    "Database"
])

mean_values_ms = [
    0.06 / 1e3,
    373.81,
    5.23
]

plt.text(-0.12, 0.06 / 1e3 + 5 , '0.06 μs')
plt.text(-0.2+1, 373.81 + 5 , '373.81 ms')
plt.text(-0.12+2, 5.23 + 5 , '5.23 ms')

colors = [
    'orange',
    'red',
    'green'
]

plt.title('Biểu đồ độ trễ')
plt.xlabel('LATENCIES', loc='right')
plt.ylim(0,450)
plt.ylabel('ms', rotation=0, loc='top')
plt.bar(x=labels , height= mean_values_ms, color=colors)
plt.show()

