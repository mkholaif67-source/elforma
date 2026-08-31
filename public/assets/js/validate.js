/* ElForma inline form validation — lightweight, RTL-friendly. */
(function () {
  'use strict';
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function fieldError(input, msg) {
    var holder = input.closest('.field') || input.parentNode;
    var e = holder.querySelector('.field-err');
    if (!e) { e = document.createElement('div'); e.className = 'field-err'; holder.appendChild(e); }
    e.textContent = msg || '';
    input.classList.toggle('invalid', !!msg);
    return !msg;
  }

  function checkOne(input) {
    var v = (input.value || '').trim();
    var type = input.getAttribute('data-check') || input.type;
    if (input.required && !v) return fieldError(input, 'الحقل مطلوب');
    if (!v) return fieldError(input, '');
    if (type === 'email' && !isEmail(v)) return fieldError(input, 'البريد غير صحيح');
    if (type === 'password' && v.length < 8) return fieldError(input, '8 أحرف على الأقل');
    if (input.getAttribute('data-match')) {
      var other = document.querySelector(input.getAttribute('data-match'));
      if (other && other.value !== v) return fieldError(input, 'الكلمتان غير متطابقتين');
    }
    return fieldError(input, '');
  }

  function attach(form) {
    var inputs = form.querySelectorAll('input[data-check], input[required], input[type=email], input[type=password]');
    inputs.forEach(function (i) {
      i.addEventListener('blur', function () { checkOne(i); });
      i.addEventListener('input', function () { if (i.classList.contains('invalid')) checkOne(i); });
    });
    form._efValidate = function () {
      var ok = true;
      inputs.forEach(function (i) { if (!checkOne(i)) ok = false; });
      return ok;
    };
  }

  window.EFValidate = {
    isEmail: isEmail,
    attach: attach,
    check: function (form) { return form._efValidate ? form._efValidate() : true; },
  };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-validate]').forEach(attach);
  });
})();
