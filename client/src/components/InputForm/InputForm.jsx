// client/src/components/InputForm/InputForm.jsx
import React, { useState, useRef } from 'react';
import { isVideoUrl, VIDEO_EXTENSIONS } from '../../config/videoBlocklist';
import './InputForm.css';

const MAX_CHAR_LIMIT = 8000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export function InputForm({ onSubmit, loading }) {
  const [activeType, setActiveType] = useState('text');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  const handleTabChange = (type) => {
    setValidationError('');
    setActiveType(type);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setValidationError('');

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isVideoExt = VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    const isVideoMime = file.type.startsWith('video/');

    if (isVideoExt || isVideoMime) {
      setValidationError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(lowerName)) {
      setValidationError('Disallowed file format. Please upload a JPEG, PNG, or WEBP image only (SVG and GIF are not supported).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setValidationError(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (activeType === 'text') {
      const trimmed = inputText.trim();
      if (!trimmed) {
        setValidationError('Please paste or type a news item, article snippet, or claim to check.');
        return;
      }
      if (trimmed.length > MAX_CHAR_LIMIT) {
        setValidationError(`Text exceeds the maximum length of ${MAX_CHAR_LIMIT} characters.`);
        return;
      }
      onSubmit('text', trimmed);
      return;
    }

    if (activeType === 'link') {
      const trimmedUrl = inputUrl.trim();
      if (!trimmedUrl) {
        setValidationError('Please enter a web article URL to check.');
        return;
      }
      try {
        const parsed = new URL(trimmedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setValidationError('Only http:// and https:// URLs are supported.');
          return;
        }
      } catch {
        setValidationError('Please enter a valid web URL (e.g., https://example.com/article).');
        return;
      }

      if (isVideoUrl(trimmedUrl)) {
        setValidationError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.");
        return;
      }

      onSubmit('link', trimmedUrl);
      return;
    }

    if (activeType === 'image') {
      if (!selectedFile) {
        setValidationError('Please select a screenshot or news photo to upload.');
        return;
      }
      onSubmit('image', selectedFile);
      return;
    }

    if (activeType === 'question') {
      setValidationError('Question mode will be activated in Phase 4.');
      return;
    }
  };

  const charCount = inputText.length;
  const isNearLimit = charCount > MAX_CHAR_LIMIT * 0.9;
  const isSubmitDisabled = loading ||
    (activeType === 'text' && !inputText.trim()) ||
    (activeType === 'link' && !inputUrl.trim()) ||
    (activeType === 'image' && !selectedFile);

  return (
    <section className="input-form-card">
      <div className="tab-navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeType === 'text'}
          className={`tab-btn ${activeType === 'text' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('text')}
        >
          📝 Text & Claims
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeType === 'link'}
          className={`tab-btn ${activeType === 'link' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('link')}
        >
          🔗 Article Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeType === 'image'}
          className={`tab-btn ${activeType === 'image' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('image')}
        >
          🖼️ Image / Screenshot
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeType === 'question'}
          className={`tab-btn ${activeType === 'question' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('question')}
        >
          ❓ Open Question <span className="tab-pill">Phase 4</span>
        </button>
      </div>

      <div className="video-policy-notice" role="note">
        <strong>Video Policy:</strong> Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.
      </div>

      <form onSubmit={handleSubmit} className="form-body">
        {activeType === 'text' && (
          <div className="input-group">
            <label htmlFor="news-text-input" className="input-label">
              Paste headline, article excerpt, or social post to verify:
            </label>
            <textarea
              id="news-text-input"
              rows={6}
              className="text-input-field"
              placeholder="e.g., 'NASA discovered liquid water oceans beneath the surface of Europa in new telescope findings...'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              maxLength={MAX_CHAR_LIMIT}
            />
            <div className="char-counter-line">
              <span className={`char-counter ${isNearLimit ? 'counter-warning' : ''}`}>
                {charCount.toLocaleString()} / {MAX_CHAR_LIMIT.toLocaleString()} characters
              </span>
            </div>
          </div>
        )}

        {activeType === 'link' && (
          <div className="input-group">
            <label htmlFor="article-url-input" className="input-label">
              Enter article or news blog URL to fetch and verify:
            </label>
            <input
              id="article-url-input"
              type="url"
              className="url-input-field"
              placeholder="https://news-outlet.org/2026/04/discovery-report"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              disabled={loading}
            />
            <p className="input-help-text">
              The server safely fetches the page, removes ads/navigation, and checks extracted factual claims.
            </p>
          </div>
        )}

        {activeType === 'image' && (
          <div className="input-group">
            <label htmlFor="image-file-input" className="input-label">
              Upload screenshot or photo of news item (JPEG, PNG, WEBP — max 5 MB):
            </label>
            <input
              id="image-file-input"
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={loading}
              className="file-input-field"
            />
            <p className="input-help-text">
              The multimodal AI reads and analyzes claims directly from the image without storing your image on the server.
            </p>

            {previewUrl && (
              <div className="image-preview-card">
                <img src={previewUrl} alt="Preview of uploaded news item" className="image-preview-thumbnail" />
                <div className="preview-info">
                  <span className="preview-filename">{selectedFile?.name}</span>
                  <span className="preview-filesize">({(selectedFile?.size / 1024).toFixed(0)} KB)</span>
                  <button type="button" onClick={handleRemoveFile} className="remove-file-btn">
                    ✕ Remove Image
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeType === 'question' && (
          <div className="placeholder-pane">
            <p>Open Question Mode with cited neutral summaries will be activated in Phase 4.</p>
          </div>
        )}

        {validationError && (
          <div className="form-error-alert" role="alert">
            {validationError}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={isSubmitDisabled}
          >
            {loading ? 'Analyzing Content...' : 'Check with Evidence ↗'}
          </button>
        </div>
      </form>
    </section>
  );
}
