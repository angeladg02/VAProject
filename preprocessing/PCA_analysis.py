import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# 1. Caricamento dati
df = pd.read_csv("data/f1_2025_full_data_v2.csv")

# 2. Selezione Gran Premio
target_event = "Dutch Grand Prix"
df_gp = df[df["EventName"] == target_event].copy()

# 3. Filtro Outlier (indispensabile per non schiacciare i cluster)
median_lap = df_gp['LapTime_Sec'].median()
df_gp = df_gp[df_gp['LapTime_Sec'] <= median_lap * 1.1].copy()

# 4. Feature Engineering: Delta Times
df_gp['S1_Delta'] = df_gp['Sector1Time_Sec'] - df_gp['Sector1Time_Sec'].min()
df_gp['S2_Delta'] = df_gp['Sector2Time_Sec'] - df_gp['Sector2Time_Sec'].min()
df_gp['S3_Delta'] = df_gp['Sector3Time_Sec'] - df_gp['Sector3Time_Sec'].min()

# 5. SOLUZIONE 1: Rimozione variabili a bassa correlazione/varianza
# Controlliamo quanto variano TrackTemp e WindSpeed. Se la variazione è minima, le escludiamo.
features = ['S1_Delta', 'S2_Delta', 'S3_Delta', 'TyreLife', 'SpeedST']

if df_gp['TrackTemp'].std() > 0.5: # Consideriamo significativa una variazione > 0.5°C
    features.append('TrackTemp')
else:
    print("TrackTemp rimossa: variazione troppo bassa (rumore).")

if df_gp['WindSpeed'].std() > 1.0: # Consideriamo significativa una variazione > 1 km/h
    features.append('WindSpeed')
else:
    print("WindSpeed rimossa: variazione troppo bassa (rumore).")

# Aggiungiamo la mescola numerica
compound_map = {"SOFT": 1, "MEDIUM": 2, "HARD": 3, "INTERMEDIATE": 4, "WET": 5}
df_gp['Compound_Num'] = df_gp['Compound'].map(compound_map)
features.append('Compound_Num')

# 6. Preparazione Dataset
meta_cols = ['Driver', 'LapNumber', 'Team', 'LapTime_Sec', 'Position', 'Compound']
data = df_gp[meta_cols + features].dropna(subset=features).copy()
data.reset_index(drop=True, inplace=True)

# 7. Normalizzazione Standard
X = StandardScaler().fit_transform(data[features])
X_df = pd.DataFrame(X, columns=features)

# 8. SOLUZIONE 2: Aumentare il peso dei tempi (Feature Weighting)
# Moltiplichiamo i delta dei settori per 1.5 per forzare la PCA a dare loro più importanza
weight = 1.5
X_df['S1_Delta'] *= weight
X_df['S2_Delta'] *= weight
X_df['S3_Delta'] *= weight

# 9. K-Means e PCA sui dati pesati
km = KMeans(n_clusters=5, init="k-means++", n_init=20, random_state=0)
data.insert(0, 'kmeans_labels', km.fit_predict(X_df))

pca = PCA(n_components=2, random_state=0)
projection = pca.fit_transform(X_df)

data['pca_x'] = projection[:, 0]
data['pca_y'] = projection[:, 1]

# 10. Log Varianza (da inserire nel report)
print(f"--- Varianza Spiegata con Pesi ({target_event}) ---")
print(f"PC1: {pca.explained_variance_ratio_[0]*100:.2f}%")
print(f"PC2: {pca.explained_variance_ratio_[1]*100:.2f}%")
print(f"Totale: {np.sum(pca.explained_variance_ratio_)*100:.2f}%")

data.to_csv("data/Dutch_Grand_Prix_Weighted.csv", index=False)