# Используем официальный образ Node.js для сборки
FROM node:20 as builder

WORKDIR /app

# Копируем зависимости
COPY package*.json ./

RUN npm install

# Копируем остальные файлы
COPY . .

# Собираем проект
RUN npm run build

# Базовый образ Apache
FROM httpd:2.4

# Копируем собранный проект из предыдущего этапа
COPY --from=builder /app/build/ /usr/local/apache2/htdocs/