"""
Kisan Web Project - PostgreSQL / Relational Database Models
Includes models for Users, Crops, DiseaseLogs, WeatherCache, CommunityPosts, FarmerPosts, Schemes, and AgriculturalTools.
"""
from datetime import datetime, timezone
import json
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db

class User(db.Model):
    """User account model with multi-role support (Farmer, Buyer, Admin)."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), default='farmer', nullable=False)  # 'farmer', 'buyer', 'admin'
    phone = db.Column(db.String(20), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    district = db.Column(db.String(100), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    farm_size_acres = db.Column(db.Float, default=0.0)
    primary_crops = db.Column(db.String(255), nullable=True)  # Comma separated
    avatar_url = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    posts = db.relationship('CommunityPost', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    farmer_posts = db.relationship('FarmerPost', backref='farmer', lazy='dynamic', cascade='all, delete-orphan')
    disease_logs = db.relationship('DiseaseLog', backref='farmer', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        """Hash and store user password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify stored password against candidate."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_sensitive=False):
        """Serialize user object to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'phone': self.phone,
            'state': self.state,
            'district': self.district,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'farm_size_acres': self.farm_size_acres,
            'primary_crops': [c.strip() for c in self.primary_crops.split(',')] if self.primary_crops else [],
            'avatar_url': self.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={self.id}",
            'bio': self.bio or "Progressive Kisan sharing real-time field progress.",
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FarmerPost(db.Model):
    """Specific field and crop progress posts created by logged-in farmers."""
    __tablename__ = 'farmer_posts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    text_content = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(255), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)  # 'image' or 'video'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'text': self.text_content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'created_at': self.created_at.strftime('%b %d, %Y') if self.created_at else None
        }


class Crop(db.Model):
    """Seasonal Crop model with workflows, climate thresholds, and hybrid advice."""
    __tablename__ = 'crops'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    scientific_name = db.Column(db.String(150), nullable=True)
    season = db.Column(db.String(50), nullable=False, index=True)  # 'kharif', 'rabi', 'zaid', 'summer'
    crop_category = db.Column(db.String(50), default='cereal')    # 'cereal', 'pulses', 'vegetable', 'cash_crop'
    growth_duration_days = db.Column(db.Integer, default=120)

    ideal_temp_min = db.Column(db.Float, default=18.0)
    ideal_temp_max = db.Column(db.Float, default=32.0)
    ideal_rainfall_min = db.Column(db.Float, default=50.0)
    ideal_rainfall_max = db.Column(db.Float, default=150.0)
    soil_type = db.Column(db.String(100), default='Alluvial, Loamy')
    ph_min = db.Column(db.Float, default=6.0)
    ph_max = db.Column(db.Float, default=7.5)

    workflow_steps_json = db.Column(db.Text, nullable=True)
    hybrid_varieties = db.Column(db.Text, nullable=True)
    youtube_tutorial_id = db.Column(db.String(50), nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    estimated_yield_per_acre = db.Column(db.String(100), nullable=True)
    market_price_range = db.Column(db.String(100), nullable=True)

    @property
    def workflow_steps(self):
        if not self.workflow_steps_json:
            return []
        try:
            return json.loads(self.workflow_steps_json)
        except Exception:
            return []

    @workflow_steps.setter
    def workflow_steps(self, steps_list):
        self.workflow_steps_json = json.dumps(steps_list)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'scientific_name': self.scientific_name,
            'season': self.season,
            'crop_category': self.crop_category,
            'growth_duration_days': self.growth_duration_days,
            'climate': {
                'temp_min': self.ideal_temp_min,
                'temp_max': self.ideal_temp_max,
                'rainfall_min': self.ideal_rainfall_min,
                'rainfall_max': self.ideal_rainfall_max,
                'soil_type': self.soil_type,
                'ph_range': f"{self.ph_min} - {self.ph_max}"
            },
            'workflow_steps': self.workflow_steps,
            'hybrid_varieties': [v.strip() for v in self.hybrid_varieties.split(',')] if self.hybrid_varieties else [],
            'youtube_tutorial_id': self.youtube_tutorial_id,
            'image_url': self.image_url,
            'estimated_yield_per_acre': self.estimated_yield_per_acre,
            'market_price_range': self.market_price_range
        }


class DiseaseLog(db.Model):
    """Crop Disease Diagnostic Log with severity and remediation tutorials."""
    __tablename__ = 'disease_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    crop_name = db.Column(db.String(100), default='Unknown')
    image_path = db.Column(db.String(255), nullable=False)
    disease_name = db.Column(db.String(150), nullable=False)
    confidence = db.Column(db.Float, default=94.5)
    severity = db.Column(db.String(30), default='Medium')
    symptoms_json = db.Column(db.Text, nullable=True)
    organic_treatment = db.Column(db.Text, nullable=True)
    chemical_treatment = db.Column(db.Text, nullable=True)
    youtube_tutorial_id = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def symptoms(self):
        if not self.symptoms_json:
            return []
        try:
            return json.loads(self.symptoms_json)
        except Exception:
            return []

    @symptoms.setter
    def symptoms(self, items):
        self.symptoms_json = json.dumps(items)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'crop_name': self.crop_name,
            'image_path': self.image_path,
            'disease_name': self.disease_name,
            'confidence': round(self.confidence, 1),
            'severity': self.severity,
            'symptoms': self.symptoms,
            'organic_treatment': self.organic_treatment,
            'chemical_treatment': self.chemical_treatment,
            'youtube_tutorial_id': self.youtube_tutorial_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class WeatherCache(db.Model):
    """Cached weather reports and 7-day forecasts for locations."""
    __tablename__ = 'weather_cache'

    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False, index=True)
    longitude = db.Column(db.Float, nullable=False, index=True)
    location_name = db.Column(db.String(150), default='Local Farm')
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    rainfall_probability = db.Column(db.Float, default=0.0)
    weather_condition = db.Column(db.String(100), default='Clear Sky')
    wind_speed_kmh = db.Column(db.Float, default=12.0)
    forecast_json = db.Column(db.Text, nullable=True)
    fetched_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def forecast(self):
        if not self.forecast_json:
            return []
        try:
            return json.loads(self.forecast_json)
        except Exception:
            return []

    @forecast.setter
    def forecast(self, items):
        self.forecast_json = json.dumps(items)

    def to_dict(self):
        return {
            'id': self.id,
            'location_name': self.location_name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'rainfall_probability': self.rainfall_probability,
            'weather_condition': self.weather_condition,
            'wind_speed_kmh': self.wind_speed_kmh,
            'forecast': self.forecast,
            'fetched_at': self.fetched_at.isoformat() if self.fetched_at else None
        }


class CommunityPost(db.Model):
    """Farmer community feed post model."""
    __tablename__ = 'community_posts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    author_name = db.Column(db.String(120), nullable=False)
    author_location = db.Column(db.String(120), default='India')
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), default='growth_update')
    media_url = db.Column(db.String(255), nullable=True)
    likes_count = db.Column(db.Integer, default=0)
    comments_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'author_name': self.author_name,
            'author_location': self.author_location,
            'title': self.title,
            'content': self.content,
            'category': self.category,
            'media_url': self.media_url,
            'likes_count': self.likes_count,
            'comments_count': self.comments_count,
            'created_at': self.created_at.strftime('%b %d, %Y') if self.created_at else None
        }


class Scheme(db.Model):
    """Government Schemes, Kisan Credit Cards, and Subsidy portals."""
    __tablename__ = 'schemes'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), default='central_gov')
    provider_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    eligibility = db.Column(db.Text, nullable=False)
    benefits = db.Column(db.Text, nullable=False)
    interest_rate_subsidy = db.Column(db.Text, nullable=True)
    application_url = db.Column(db.String(255), nullable=True)
    badge_label = db.Column(db.String(50), default='Active')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'provider_name': self.provider_name,
            'description': self.description,
            'eligibility': self.eligibility,
            'benefits': self.benefits,
            'interest_rate_subsidy': self.interest_rate_subsidy,
            'application_url': self.application_url,
            'badge_label': self.badge_label
        }


class AgriculturalTool(db.Model):
    """Modern agricultural equipment and machinery models."""
    __tablename__ = 'agricultural_tools'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), default='drone')
    specs_json = db.Column(db.Text, nullable=True)
    price_range = db.Column(db.String(100), nullable=True)
    subsidy_available = db.Column(db.String(100), nullable=True)
    video_demo_url = db.Column(db.String(255), nullable=True)
    image_url = db.Column(db.String(255), nullable=True)
    model_3d_identifier = db.Column(db.String(50), default='drone_3d')
    description = db.Column(db.Text, nullable=True)

    @property
    def specs(self):
        if not self.specs_json:
            return {}
        try:
            return json.loads(self.specs_json)
        except Exception:
            return {}

    @specs.setter
    def specs(self, spec_dict):
        self.specs_json = json.dumps(spec_dict)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'specs': self.specs,
            'price_range': self.price_range,
            'subsidy_available': self.subsidy_available,
            'video_demo_url': self.video_demo_url,
            'image_url': self.image_url,
            'model_3d_identifier': self.model_3d_identifier,
            'description': self.description
        }