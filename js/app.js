/**
 * PhotoShare - Aplicación de Transferencia de Imágenes
 * Estilo iOS con Supabase Backend
 */

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
const SUPABASE_URL = 'https://qbosmdcjhfckxhswjxci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFib3NtZGNqaGZja3hoc3dqeGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDQ0OTAsImV4cCI6MjA4ODEyMDQ5MH0.dGujuwit8lnC5oSLvKQvBxgYE6CMO_JytBwyuPEdzOs';
const ADMIN_PIN = '12345678';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// CLASE PRINCIPAL DE LA APLICACIÓN
// ============================================
class PhotoShareApp {
    constructor() {
        this.currentScreen = 'role-selection';
        this.currentFolder = null;
        this.currentRole = null;
        this.pinBuffer = '';
        this.folders = [];
        this.images = [];
        this.previewImageUrl = null;
        this.isAdmin = false;
        
        this.init();
    }

    async init() {
        // Verificar si ya está autenticado como publicador
        const savedPin = localStorage.getItem('photoshare_admin_pin');
        if (savedPin === ADMIN_PIN) {
            this.isAdmin = true;
        }

        // Configurar drag and drop
        this.setupDragAndDrop();

        // Cargar datos iniciales
        await this.loadFolders();
    }

    // ============================================
    // NAVEGACIÓN
    // ============================================
    selectRole(role) {
        this.currentRole = role;
        
        if (role === 'publicador') {
            if (this.isAdmin) {
                this.showScreen('publicador-screen');
                this.loadAdminFolders();
            } else {
                this.showPinModal();
            }
        } else {
            this.showScreen('anfitrion-screen');
            this.loadFolders();
        }
    }

    showScreen(screenId) {
        // Ocultar pantalla actual
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Mostrar nueva pantalla
        const newScreen = document.getElementById(screenId);
        if (newScreen) {
            newScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    goHome() {
        this.currentFolder = null;
        this.showScreen('role-selection');
    }

    backToFolders() {
        this.currentFolder = null;
        this.showScreen('anfitrion-screen');
        this.loadFolders();
    }

    backToAdminFolders() {
        this.currentFolder = null;
        this.showScreen('publicador-screen');
        this.loadAdminFolders();
    }

    // ============================================
    // PIN MODAL
    // ============================================
    showPinModal() {
        this.pinBuffer = '';
        this.updatePinDisplay();
        document.getElementById('pin-error').classList.remove('show');
        document.getElementById('pin-modal').classList.add('active');
    }

    closePinModal() {
        document.getElementById('pin-modal').classList.remove('active');
        this.pinBuffer = '';
        this.updatePinDisplay();
    }

    enterPin(digit) {
        if (this.pinBuffer.length < 8) {
            this.pinBuffer += digit;
            this.updatePinDisplay();
            
            if (this.pinBuffer.length === 8) {
                this.validatePin();
            }
        }
    }

    deletePin() {
        this.pinBuffer = this.pinBuffer.slice(0, -1);
        this.updatePinDisplay();
        document.getElementById('pin-error').classList.remove('show');
        document.querySelectorAll('.pin-dots .dot').forEach(dot => {
            dot.classList.remove('error');
        });
    }

    updatePinDisplay() {
        const dots = document.querySelectorAll('.pin-dots .dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('filled', index < this.pinBuffer.length);
        });
    }

    validatePin() {
        if (this.pinBuffer === ADMIN_PIN) {
            this.isAdmin = true;
            localStorage.setItem('photoshare_admin_pin', ADMIN_PIN);
            this.closePinModal();
            this.showScreen('publicador-screen');
            this.loadAdminFolders();
            this.showToast('Acceso concedido');
        } else {
            document.getElementById('pin-error').classList.add('show');
            document.querySelectorAll('.pin-dots .dot').forEach(dot => {
                dot.classList.add('error');
            });
            setTimeout(() => {
                this.pinBuffer = '';
                this.updatePinDisplay();
                document.querySelectorAll('.pin-dots .dot').forEach(dot => {
                    dot.classList.remove('error');
                });
            }, 500);
        }
    }

    // ============================================
    // CARPETAS
    // ============================================
    async loadFolders() {
        this.showLoading('Cargando carpetas...');
        
        try {
            const { data, error } = await supabase
                .from('folders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.folders = data || [];
            this.renderFolders();
        } catch (err) {
            console.error('Error cargando carpetas:', err);
            this.showToast('Error al cargar carpetas');
        } finally {
            this.hideLoading();
        }
    }

    async loadAdminFolders() {
        await this.loadFolders();
        this.renderAdminFolders();
    }

    renderFolders() {
        const container = document.getElementById('folders-list');
        const emptyState = document.getElementById('empty-folders');
        
        if (this.folders.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        container.innerHTML = this.folders.map(folder => `
            <div class="folder-card" onclick="app.openFolder('${folder.id}', '${folder.name}')">
                <div class="folder-icon">📁</div>
                <div class="folder-name">${this.escapeHtml(folder.name)}</div>
                <div class="folder-count">Cargando...</div>
            </div>
        `).join('');

        // Cargar conteos
        this.folders.forEach(folder => {
            this.loadImageCount(folder.id);
        });
    }

    renderAdminFolders() {
        const container = document.getElementById('admin-folders-list');
        const emptyState = document.getElementById('admin-empty-folders');
        
        if (this.folders.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        container.innerHTML = this.folders.map(folder => `
            <div class="folder-card">
                <button class="folder-delete-btn" onclick="event.stopPropagation(); app.deleteFolder('${folder.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
                <div class="folder-icon" onclick="app.openAdminFolder('${folder.id}', '${folder.name}')">📁</div>
                <div class="folder-name" onclick="app.openAdminFolder('${folder.id}', '${folder.name}')">${this.escapeHtml(folder.name)}</div>
                <div class="folder-count" onclick="app.openAdminFolder('${folder.id}', '${folder.name}')">Cargando...</div>
            </div>
        `).join('');

        this.folders.forEach(folder => {
            this.loadImageCount(folder.id);
        });
    }

    async loadImageCount(folderId) {
        try {
            const { count, error } = await supabase
                .from('images')
                .select('*', { count: 'exact', head: true })
                .eq('folder_id', folderId);

            if (error) throw error;

            const countText = count === 1 ? '1 imagen' : `${count || 0} imágenes`;
            
            // Actualizar el conteo en todas las vistas
            document.querySelectorAll('.folder-card').forEach(card => {
                if (card.querySelector('.folder-name')?.textContent === this.folders.find(f => f.id === folderId)?.name) {
                    card.querySelector('.folder-count').textContent = countText;
                }
            });
        } catch (err) {
            console.error('Error cargando conteo:', err);
        }
    }

    // ============================================
    // CREAR CARPETA
    // ============================================
    showCreateFolderModal() {
        document.getElementById('folder-name-input').value = '';
        document.getElementById('create-folder-modal').classList.add('active');
        setTimeout(() => document.getElementById('folder-name-input').focus(), 100);
    }

    closeCreateFolderModal() {
        document.getElementById('create-folder-modal').classList.remove('active');
    }

    async createFolder() {
        const nameInput = document.getElementById('folder-name-input');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showToast('Ingresa un nombre para la carpeta');
            return;
        }

        this.showLoading('Creando carpeta...');
        
        try {
            const { data, error } = await supabase
                .from('folders')
                .insert([{ name }])
                .select()
                .single();

            if (error) throw error;

            this.folders.unshift(data);
            this.renderAdminFolders();
            this.closeCreateFolderModal();
            this.showToast('Carpeta creada');
        } catch (err) {
            console.error('Error creando carpeta:', err);
            this.showToast('Error al crear carpeta');
        } finally {
            this.hideLoading();
        }
    }

    async deleteFolder(folderId) {
        if (!confirm('¿Eliminar esta carpeta y todas sus imágenes?')) return;

        this.showLoading('Eliminando...');
        
        try {
            // Obtener imágenes para eliminar del storage
            const { data: images, error: imagesError } = await supabase
                .from('images')
                .select('storage_path')
                .eq('folder_id', folderId);

            if (imagesError) throw imagesError;

            // Eliminar archivos del storage
            if (images && images.length > 0) {
                const paths = images.map(img => img.storage_path);
                await supabase.storage.from('images').remove(paths);
            }

            // Eliminar carpeta (las imágenes se eliminan en cascada)
            const { error } = await supabase
                .from('folders')
                .delete()
                .eq('id', folderId);

            if (error) throw error;

            this.folders = this.folders.filter(f => f.id !== folderId);
            this.renderAdminFolders();
            this.showToast('Carpeta eliminada');
        } catch (err) {
            console.error('Error eliminando carpeta:', err);
            this.showToast('Error al eliminar carpeta');
        } finally {
            this.hideLoading();
        }
    }

    async deleteCurrentFolder() {
        if (this.currentFolder) {
            await this.deleteFolder(this.currentFolder.id);
            this.backToAdminFolders();
        }
    }

    // ============================================
    // IMÁGENES
    // ============================================
    async openFolder(folderId, folderName) {
        this.currentFolder = { id: folderId, name: folderName };
        document.getElementById('folder-name').textContent = folderName;
        this.showScreen('images-screen');
        await this.loadImages(folderId);
    }

    async openAdminFolder(folderId, folderName) {
        this.currentFolder = { id: folderId, name: folderName };
        document.getElementById('upload-folder-name').textContent = folderName;
        this.showScreen('upload-screen');
        await this.loadAdminImages(folderId);
    }

    async loadImages(folderId) {
        this.showLoading('Cargando imágenes...');
        
        try {
            const { data, error } = await supabase
                .from('images')
                .select('*')
                .eq('folder_id', folderId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.images = data || [];
            this.renderImages();
        } catch (err) {
            console.error('Error cargando imágenes:', err);
            this.showToast('Error al cargar imágenes');
        } finally {
            this.hideLoading();
        }
    }

    async loadAdminImages(folderId) {
        await this.loadImages(folderId);
        this.renderAdminImages();
    }

    renderImages() {
        const container = document.getElementById('images-grid');
        const emptyState = document.getElementById('empty-images');
        
        if (this.images.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        container.innerHTML = this.images.map(img => `
            <div class="image-item" onclick="app.showPreview('${img.url}')">
                <img src="${img.url}" alt="${this.escapeHtml(img.original_name)}" loading="lazy">
            </div>
        `).join('');
    }

    renderAdminImages() {
        const container = document.getElementById('admin-images-grid');
        const emptyState = document.getElementById('admin-empty-images');
        
        if (this.images.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        
        container.innerHTML = this.images.map(img => `
            <div class="image-item admin" onclick="app.deleteImage('${img.id}', '${img.storage_path}')">
                <img src="${img.url}" alt="${this.escapeHtml(img.original_name)}" loading="lazy">
            </div>
        `).join('');
    }

    async deleteImage(imageId, storagePath) {
        if (!confirm('¿Eliminar esta imagen?')) return;

        this.showLoading('Eliminando...');
        
        try {
            // Eliminar del storage
            await supabase.storage.from('images').remove([storagePath]);

            // Eliminar de la base de datos
            const { error } = await supabase
                .from('images')
                .delete()
                .eq('id', imageId);

            if (error) throw error;

            this.images = this.images.filter(img => img.id !== imageId);
            this.renderAdminImages();
            this.showToast('Imagen eliminada');
        } catch (err) {
            console.error('Error eliminando imagen:', err);
            this.showToast('Error al eliminar imagen');
        } finally {
            this.hideLoading();
        }
    }

    // ============================================
    // SUBIDA DE IMÁGENES
    // ============================================
    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    handleFileSelect(event) {
        this.handleFiles(event.target.files);
    }

    async handleFiles(files) {
        if (!this.currentFolder) return;
        
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showToast('Selecciona archivos de imagen');
            return;
        }

        for (const file of imageFiles) {
            await this.uploadImage(file);
        }

        await this.loadAdminImages(this.currentFolder.id);
    }

    async uploadImage(file) {
        this.showLoading(`Subiendo ${file.name}...`);
        
        try {
            // Generar nombre único
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const extension = file.name.split('.').pop();
            const filename = `${timestamp}_${random}.${extension}`;
            const storagePath = `${this.currentFolder.id}/${filename}`;

            // Subir a Storage
            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(storagePath);

            // Guardar en base de datos
            const { error: dbError } = await supabase
                .from('images')
                .insert([{
                    folder_id: this.currentFolder.id,
                    filename: filename,
                    original_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    storage_path: storagePath,
                    url: publicUrl
                }]);

            if (dbError) throw dbError;

            this.showToast(`✓ ${file.name.substring(0, 20)}${file.name.length > 20 ? '...' : ''}`);
        } catch (err) {
            console.error('Error subiendo imagen:', err);
            this.showToast(`Error: ${file.name.substring(0, 20)}`);
        } finally {
            this.hideLoading();
        }
    }

    // ============================================
    // VISTA PREVIA Y DESCARGA
    // ============================================
    showPreview(url) {
        this.previewImageUrl = url;
        document.getElementById('preview-image').src = url;
        document.getElementById('preview-modal').classList.add('active');
    }

    closePreview() {
        document.getElementById('preview-modal').classList.remove('active');
        this.previewImageUrl = null;
    }

    downloadCurrentImage() {
        if (this.previewImageUrl) {
            this.downloadImage(this.previewImageUrl);
        }
    }

    downloadImage(url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop();
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Descargando...');
    }

    async downloadAllImages() {
        if (this.images.length === 0) return;
        
        this.showToast(`Descargando ${this.images.length} imágenes...`);
        
        for (const img of this.images) {
            await new Promise(resolve => setTimeout(resolve, 300));
            this.downloadImage(img.url);
        }
    }

    // ============================================
    // UTILIDADES
    // ============================================
    showLoading(text = 'Cargando...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async refreshData() {
        if (this.currentScreen === 'anfitrion-screen') {
            await this.loadFolders();
        } else if (this.currentScreen === 'images-screen' && this.currentFolder) {
            await this.loadImages(this.currentFolder.id);
        }
    }
}

// ============================================
// INICIALIZAR APLICACIÓN
// ============================================
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new PhotoShareApp();
});

// Manejar tecla Enter en input de carpeta
document.addEventListener('DOMContentLoaded', () => {
    const folderInput = document.getElementById('folder-name-input');
    if (folderInput) {
        folderInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                app.createFolder();
            }
        });
    }
});
