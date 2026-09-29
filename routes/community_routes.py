"""
Kisan Web Project - Community & Farmer Profile Blueprint Routes
Handles community feed, farmer profile queries, and uploading field progress updates.
"""
import os
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
from extensions import db
from models import User, CommunityPost, FarmerPost

community_bp = Blueprint('community', __name__, url_prefix='/api/community')

# GET /api/community/posts
@community_bp.route('/posts', methods=['GET'])
def get_posts():
    category = request.args.get('category')
    query = CommunityPost.query
    if category and category != 'all':
        query = query.filter_by(category=category)
    posts = query.order_by(CommunityPost.created_at.desc()).all()
    return jsonify({'posts': [p.to_dict() for p in posts]}), 200

# POST /api/community/posts
@community_bp.route('/posts', methods=['POST'])
def create_post():
    title = request.form.get('title')
    content = request.form.get('content')
    category = request.form.get('category', 'growth_update')
    author_name = request.form.get('author_name', 'Progressive Kisan')
    author_location = request.form.get('author_location', 'India')

    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400

    media_url = None
    media_file = request.files.get('media')
    if media_file and media_file.filename:
        filename = secure_filename(media_file.filename)
        save_dir = os.path.join(current_app.static_folder, 'uploads', 'posts')
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, filename)
        media_file.save(file_path)
        media_url = f'/static/uploads/posts/{filename}'

    # Use existing user or default fallback
    user = User.query.first()
    user_id = user.id if user else 1

    new_post = CommunityPost(
        user_id=user_id,
        author_name=author_name,
        author_location=author_location,
        title=title,
        content=content,
        category=category,
        media_url=media_url
    )
    db.session.add(new_post)
    db.session.commit()
    return jsonify({'message': 'Post created successfully', 'post': new_post.to_dict()}), 201

# POST /api/community/posts/<id>/like
@community_bp.route('/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    post = CommunityPost.query.get_or_404(post_id)
    post.likes_count += 1
    db.session.commit()
    return jsonify({'likes_count': post.likes_count}), 200

# GET /api/farmers/<id>/profile
@community_bp.route('/farmers/<int:farmer_id>/profile', methods=['GET'])
def get_farmer_profile(farmer_id):
    farmer = User.query.get_or_404(farmer_id)
    posts = FarmerPost.query.filter_by(user_id=farmer_id).order_by(FarmerPost.created_at.desc()).all()
    profile_data = farmer.to_dict()
    profile_data['posts'] = [p.to_dict() for p in posts]
    return jsonify(profile_data), 200

# POST /api/farmers/posts/create
@community_bp.route('/farmers/posts/create', methods=['POST'])
def create_field_progress_post():
    text_content = request.form.get('text_content', '')
    media_file = request.files.get('media_file')

    if not text_content and not media_file:
        return jsonify({'error': 'Please provide text content or a photo/video attachment.'}), 400

    media_url = None
    media_type = None

    if media_file and media_file.filename:
        filename = secure_filename(media_file.filename)
        save_dir = os.path.join(current_app.static_folder, 'uploads', 'posts')
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, filename)
        media_file.save(file_path)
        media_url = f'/static/uploads/posts/{filename}'

        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext in ['mp4', 'webm', 'mov', 'mkv']:
            media_type = 'video'
        else:
            media_type = 'image'

    user_id = session.get('user_id')
    if not user_id:
        user = User.query.first()
        user_id = user.id if user else 1

    post = FarmerPost(
        user_id=user_id,
        text_content=text_content,
        media_url=media_url,
        media_type=media_type
    )
    db.session.add(post)
    db.session.commit()

    return jsonify({'message': 'Field progress updated successfully!', 'post': post.to_dict()}), 201