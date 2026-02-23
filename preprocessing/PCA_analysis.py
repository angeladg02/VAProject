import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score
from sklearn.preprocessing import StandardScaler, MinMaxScaler

#load data
df = pd.read_csv("data/f1_2025_full_data_v2.csv")

#we select only data related to one grand prix
df = df[df["EventName"] == "Australian Grand Prix"].copy()

#keep only necessary columns for performing clustering
features = [
    'Sector1Time_Sec', 
    'Sector2Time_Sec', 
    'Sector3Time_Sec', 
    'TyreLife', 
    'TrackTemp', 
    'SpeedST',
    'Compound_Num'
]

#values to preserve
meta_cols = ['Driver', 'LapNumber', 'Team', 'LapTime_Sec', 'Position']

#conversion of compound types in numbers
compound_map = {
    "SOFT" : 1,
    "MEDIUM" : 2,
    "HARD" : 3,
    "INTERMEDIATE" : 4,
    "WET" : 5
}

df['Compound_Num'] = df['Compound'].map(compound_map)

#we remove the data that we don't need
columns_to_keep = meta_cols + features
data = df[columns_to_keep].copy()

#we remove NaN features
data = data.dropna(subset=features).copy()
#reset index
data.reset_index(drop=True, inplace=True)
#extract numerical value that have to be normalized
numerical_values = data[features]
#normalize data
numerical_values = StandardScaler().fit_transform(numerical_values)

#cluster the data with k-means
km = KMeans(n_clusters=5, init="k-means++", n_init=20, random_state=0)
labels = km.fit_predict(numerical_values)
data.insert(0, 'kmeans_labels', labels)



# compute 2D PCA and append the values in the dataframe as pca_x, pca_y
projection = PCA(n_components=2, random_state=0).fit_transform(numerical_values)
projection = MinMaxScaler().fit_transform(projection)
data.insert(len(data.columns), 'pca_x', projection[:,0])
data.insert(len(data.columns), 'pca_y', projection[:,1])


# save the new csv file
data.to_csv("data/Australian_Grand_Prix.csv", index=False)

