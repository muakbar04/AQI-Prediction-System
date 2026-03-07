from sqlalchemy import Column, Integer, Float, DateTime
from app.core.database import Base

class AQIFeature(Base):
    __tablename__ = "aqi_features"

    # We use timestamp as the primary key since it's a time-series dataset
    timestamp = Column(DateTime, primary_key=True, index=True)
    temp = Column(Float)
    humidity = Column(Float)
    wind_speed = Column(Float)
    pm25 = Column(Float)
    pm10 = Column(Float)
    no2 = Column(Float)
    o3 = Column(Float)
    year = Column(Integer)
    month = Column(Integer)
    day = Column(Integer)
    hour = Column(Integer)
    weekday = Column(Integer)
    aqi_pm25 = Column(Float)
    pm25_change = Column(Float)
    aqi_change_rate = Column(Float)
    pm25_3h_mean = Column(Float)
    pm25_24h_mean = Column(Float)