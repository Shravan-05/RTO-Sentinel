import re
import numpy as np
import pandas as pd

SUSPICIOUS_NAMES = {'test', 'test order', 'asdf', 'qwerty', 'na', 'abc', 'xyz xyz', 'xyz', 'aaa'}
VAGUE_ADDRESSES = {'.', 'xyz', 'home', 'call me', 'near station'}
LANDMARK_KEYWORDS = [
    'near', 'opp', 'opp.', 'ke paas', 'ke saamne', 'peeche', 'chowk', 
    'sector', 'society', 'apartments', 'flat', 'house', 'road', 'marg', 'nagar', 'gali'
]

NUMERIC_FEATURES = [
    'order_value', 'num_items', 'avg_item_price', 'customer_prior_orders',
    'customer_prior_rto', 'prior_rto_rate', 'address_length', 'address_word_count',
    'name_word_count', 'name_length', 'city_rto_risk', 'pin_rto_risk',
    'is_first_time', 'has_prior_rto', 'multiple_prior_rto', 'is_suspicious_name',
    'is_vague_address', 'has_landmark', 'is_high_value', 'is_low_value',
    'order_hour', 'order_dayofweek', 'is_night_order', 'is_weekend', 'missing_pincode'
]

CATEGORICAL_FEATURES = ['utm_source_clean', 'state_clean']

def clean_data(df: pd.DataFrame, drop_in_transit: bool = True) -> pd.DataFrame:
    df = df.copy()
    df = df.drop_duplicates(subset=['order_id'])
    if 'final_status' in df.columns:
        df['final_status_clean'] = df['final_status'].astype(str).str.strip().str.upper()
        if drop_in_transit:
            df = df[df['final_status_clean'].isin(['DELIVERED', 'RTO'])].copy()
            df['target'] = (df['final_status_clean'] == 'RTO').astype(int)
    return df

def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    
    prior_orders = df['customer_prior_orders'].fillna(0).astype(float)
    prior_rto = df['customer_prior_rto'].fillna(0).astype(float)
    df['is_first_time'] = (prior_orders == 0).astype(int)
    df['prior_rto_rate'] = prior_rto / (prior_orders + 1.0)
    df['has_prior_rto'] = (prior_rto > 0).astype(int)
    df['multiple_prior_rto'] = (prior_rto >= 2).astype(int)
    
    cleaned_names = df['customer_name'].astype(str).str.strip().str.lower()
    df['is_suspicious_name'] = cleaned_names.isin(SUSPICIOUS_NAMES).astype(int)
    df['name_word_count'] = cleaned_names.apply(lambda x: len(x.split()))
    df['name_length'] = cleaned_names.str.len()
    
    cleaned_addr = df['address'].astype(str).str.strip().str.lower()
    df['address_length'] = cleaned_addr.str.len()
    df['address_word_count'] = cleaned_addr.apply(lambda x: len(x.split()))
    df['is_vague_address'] = (cleaned_addr.isin(VAGUE_ADDRESSES) | (df['address_length'] < 10)).astype(int)
    
    def has_landmark_text(addr):
        return int(any(k in addr for k in LANDMARK_KEYWORDS))
    df['has_landmark'] = cleaned_addr.apply(has_landmark_text)
    
    order_val = df['order_value'].fillna(0).astype(float)
    num_items = df['num_items'].fillna(1).astype(float)
    df['avg_item_price'] = order_val / (num_items + 1e-5)
    df['is_high_value'] = (order_val >= 1500).astype(int)
    df['is_low_value'] = (order_val <= 450).astype(int)
    
    if 'order_datetime' in df.columns:
        dt = pd.to_datetime(df['order_datetime'], errors='coerce')
        df['order_hour'] = dt.dt.hour.fillna(12).astype(int)
        df['order_dayofweek'] = dt.dt.dayofweek.fillna(0).astype(int)
        df['is_night_order'] = ((df['order_hour'] >= 23) | (df['order_hour'] <= 5)).astype(int)
        df['is_weekend'] = (df['order_dayofweek'] >= 5).astype(int)
    else:
        df['order_hour'] = 12
        df['order_dayofweek'] = 0
        df['is_night_order'] = 0
        df['is_weekend'] = 0

    df['city_clean'] = df['city'].astype(str).str.strip().str.title()
    df['state_clean'] = df['state'].astype(str).str.strip().str.title()
    
    def extract_pin_prefix(p):
        try:
            s = str(p).split('.')[0].strip()
            if len(s) >= 2 and s.isdigit():
                return s[:2]
            return 'UNK'
        except:
            return 'UNK'
    df['pin_prefix'] = df['pincode'].apply(extract_pin_prefix)
    df['missing_pincode'] = df['pincode'].isna().astype(int)
    
    df['utm_source_clean'] = df['utm_source'].fillna('direct').astype(str).str.strip().str.lower()
    
    return df

class DataPipeline:
    def __init__(self, city_risk_map=None, pincode_risk_map=None):
        self.city_risk_map = city_risk_map or {}
        self.pincode_risk_map = pincode_risk_map or {}
        self.global_mean = 0.284

    def transform_single_order(self, order_dict: dict) -> pd.DataFrame:
        row = {
            'order_id': order_dict.get('order_id', 'ORD_0'),
            'order_value': float(order_dict.get('order_value', 649.0)),
            'payment_method': order_dict.get('payment_method', 'COD'),
            'address': order_dict.get('shipping_address') or order_dict.get('address', ''),
            'city': order_dict.get('shipping_city') or order_dict.get('city', ''),
            'state': order_dict.get('shipping_state') or order_dict.get('state', ''),
            'pincode': str(order_dict.get('shipping_pincode') or order_dict.get('pincode', '')),
            'customer_name': order_dict.get('customer_name', 'Customer'),
            'customer_prior_orders': int(order_dict.get('customer_prior_orders', 0)),
            'customer_prior_rto': int(order_dict.get('customer_prior_rto', 0)),
            'num_items': int(order_dict.get('num_items', 1)),
            'order_datetime': order_dict.get('created_at') or order_dict.get('order_datetime', '2026-09-01 12:00:00'),
            'utm_source': order_dict.get('utm_source', 'direct')
        }
        
        df = pd.DataFrame([row])
        df_feat = extract_features(df)
        
        df_feat['city_rto_risk'] = df_feat['city_clean'].map(self.city_risk_map).fillna(self.global_mean)
        df_feat['pin_rto_risk'] = df_feat['pin_prefix'].map(self.pincode_risk_map).fillna(self.global_mean)
        
        return df_feat[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
