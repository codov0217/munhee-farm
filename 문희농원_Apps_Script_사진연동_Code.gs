const SHEET_NAME = '작업기록';
const PHOTO_FOLDER_NAME = '문희농원 작업사진';
const HEADERS = [
  '기록ID', '작업일', '필지', '작목', '작업종류', '작업자',
  '작업량', '메모', '사진링크', '등록일', '최종수정일', '삭제여부'
];

function doGet() {
  try {
    return response_({ ok: true, records: getRecords_() });
  } catch (error) {
    return response_({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action === 'save') saveRecord_(data.record || {});
    else if (data.action === 'delete') deleteRecord_(data.record && data.record.recordUid);
    else if (data.action === 'uploadPhoto') {
      return response_({ ok: true, url: uploadPhoto_(data.photo || {}) });
    } else {
      throw new Error('알 수 없는 요청입니다.');
    }
    return response_({ ok: true });
  } catch (error) {
    return response_({ ok: false, message: error.message });
  }
}

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#2f6f4e').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

function getRecords_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(row => String(row[11]).toUpperCase() !== 'Y')
    .map(row => ({
      recordUid: String(row[0] || ''), workDate: dateText_(row[1]),
      field: String(row[2] || ''), crop: String(row[3] || ''),
      work: String(row[4] || ''), worker: String(row[5] || ''),
      amount: String(row[6] || ''), memo: String(row[7] || ''),
      photos: parsePhotos_(row[8]), createdAt: dateTimeText_(row[9]),
      updatedAt: dateTimeText_(row[10])
    }))
    .sort((a, b) => (b.workDate + b.createdAt).localeCompare(a.workDate + a.createdAt));
}

function saveRecord_(record) {
  if (!record.recordUid) throw new Error('기록ID가 없습니다.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String) : [];
  const index = ids.indexOf(String(record.recordUid));
  const now = new Date().toISOString();
  const row = [[
    record.recordUid, record.workDate || '', record.field || '', record.crop || '',
    record.work || '', record.worker || '', record.amount || '', record.memo || '',
    JSON.stringify(record.photos || []), record.createdAt || now, now, ''
  ]];
  if (index >= 0) {
    const sheetRow = index + 2;
    row[0][9] = sheet.getRange(sheetRow, 10).getValue() || row[0][9];
    sheet.getRange(sheetRow, 1, 1, HEADERS.length).setValues(row);
  } else {
    sheet.getRange(lastRow + 1, 1, 1, HEADERS.length).setValues(row);
  }
}

function deleteRecord_(recordUid) {
  if (!recordUid) throw new Error('기록ID가 없습니다.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
  const index = ids.indexOf(String(recordUid));
  if (index >= 0) sheet.getRange(index + 2, 12).setValue('Y');
}

function uploadPhoto_(photo) {
  const dataUrl = String(photo.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('사진 형식을 확인할 수 없습니다.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('사진 용량이 너무 큽니다. 다시 촬영해 주세요.');
  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const date = String(photo.workDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  const index = Number(photo.index || 1);
  const filename = `${date}_작업사진_${index}_${Date.now()}.${extension}`;
  const file = getPhotoFolder_().createFile(Utilities.newBlob(bytes, mimeType, filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}

function getPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function parsePhotos_(value) {
  try { const photos = JSON.parse(value || '[]'); return Array.isArray(photos) ? photos : []; }
  catch (e) { return []; }
}
function dateText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value))
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value || '');
}
function dateTimeText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value.toISOString();
  return String(value || '');
}
