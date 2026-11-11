    /* =========================================================================
       0. DIÁLOGOS E TOASTS ESTILIZADOS NA IDENTIDADE NAUMTERIA (SEM TRAVAMENTO)
       ========================================================================= */
    window.appToast = function(msg, type = 'info', durationMs = 3200) {
      let icon = 'ℹ️';
      if (type === 'success') icon = '✅';
      else if (type === 'warn' || type === 'warning') icon = '⚠️';
      else if (type === 'danger' || type === 'error') icon = '❌';

      let toast = document.getElementById('globalAppToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalAppToast';
        toast.className = 'share-toast';
        document.body.appendChild(toast);
      }
      const iconEl = document.createElement('span');
      iconEl.style.fontSize = '16px';
      iconEl.textContent = icon;
      const msgEl = document.createElement('span');
      msgEl.textContent = String(msg);
      toast.replaceChildren(iconEl, msgEl);
      toast.style.display = 'flex';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        toast.style.display = 'none';
      }, durationMs);
    };

    window.appAlert = function(msg, title = 'Aviso') {
      return new Promise(resolve => {
        const modal = document.getElementById('appDialogModal');
        const icon = document.getElementById('appDialogIcon');
        const titleEl = document.getElementById('appDialogTitle');
        const msgEl = document.getElementById('appDialogMessage');
        const inputWrap = document.getElementById('appDialogInputWrap');
        const cancelBtn = document.getElementById('appDialogCancelBtn');
        const confirmBtn = document.getElementById('appDialogConfirmBtn');
        const closeBtn = document.getElementById('appDialogCloseBtn');

        if (!modal) {
          window.appToast(msg, 'info');
          resolve();
          return;
        }

        icon.textContent = 'ℹ️';
        titleEl.textContent = title;
        msgEl.textContent = msg;
        inputWrap.style.display = 'none';
        cancelBtn.style.display = 'none';
        confirmBtn.className = 'btn btn-gold';
        confirmBtn.textContent = 'OK';
        modal.style.display = 'flex';

        const done = () => {
          modal.style.display = 'none';
          confirmBtn.removeEventListener('click', onConfirm);
          closeBtn.removeEventListener('click', onConfirm);
          modal.removeEventListener('click', onBackdrop);
          resolve();
        };
        const onConfirm = () => done();
        const onBackdrop = (e) => { if (e.target === modal) done(); };

        confirmBtn.addEventListener('click', onConfirm);
        closeBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdrop);
      });
    };

    window.appConfirm = function(msg, title = 'Confirmação', options = {}) {
      return new Promise(resolve => {
        const modal = document.getElementById('appDialogModal');
        const icon = document.getElementById('appDialogIcon');
        const titleEl = document.getElementById('appDialogTitle');
        const msgEl = document.getElementById('appDialogMessage');
        const inputWrap = document.getElementById('appDialogInputWrap');
        const cancelBtn = document.getElementById('appDialogCancelBtn');
        const confirmBtn = document.getElementById('appDialogConfirmBtn');
        const closeBtn = document.getElementById('appDialogCloseBtn');

        if (!modal) {
          resolve(window.confirm(msg));
          return;
        }

        icon.textContent = options.isDanger ? '⚠️' : '🥁';
        titleEl.textContent = title;
        msgEl.textContent = msg;
        inputWrap.style.display = 'none';
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = options.cancelText || 'Cancelar';
        confirmBtn.className = options.isDanger ? 'btn btn-danger' : 'btn btn-gold';
        confirmBtn.textContent = options.confirmText || 'Confirmar';
        modal.style.display = 'flex';

        const cleanup = () => {
          modal.style.display = 'none';
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancel);
          closeBtn.removeEventListener('click', onCancel);
          modal.removeEventListener('click', onBackdrop);
        };
        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const onBackdrop = (e) => { if (e.target === modal) onCancel(); };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
      });
    };

    window.appPrompt = function(msg, defaultValue = '', title = 'Definir Valor') {
      return new Promise(resolve => {
        const modal = document.getElementById('appDialogModal');
        const icon = document.getElementById('appDialogIcon');
        const titleEl = document.getElementById('appDialogTitle');
        const msgEl = document.getElementById('appDialogMessage');
        const inputWrap = document.getElementById('appDialogInputWrap');
        const input = document.getElementById('appDialogInput');
        const cancelBtn = document.getElementById('appDialogCancelBtn');
        const confirmBtn = document.getElementById('appDialogConfirmBtn');
        const closeBtn = document.getElementById('appDialogCloseBtn');

        if (!modal) {
          resolve(window.prompt(msg, defaultValue));
          return;
        }

        icon.textContent = '✎';
        titleEl.textContent = title;
        msgEl.textContent = msg;
        inputWrap.style.display = 'block';
        input.value = defaultValue || '';
        cancelBtn.style.display = 'inline-flex';
        confirmBtn.className = 'btn btn-gold';
        confirmBtn.textContent = 'Salvar';
        modal.style.display = 'flex';
        setTimeout(() => { input.focus(); input.select(); }, 50);

        const cleanup = () => {
          modal.style.display = 'none';
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancel);
          closeBtn.removeEventListener('click', onCancel);
          input.removeEventListener('keydown', onKey);
          modal.removeEventListener('click', onBackdrop);
        };
        const onConfirm = () => { cleanup(); resolve(input.value); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onBackdrop = (e) => { if (e.target === modal) onCancel(); };
        const onKey = (e) => {
          if (e.key === 'Enter') onConfirm();
          else if (e.key === 'Escape') onCancel();
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
        modal.addEventListener('click', onBackdrop);
      });
    };
