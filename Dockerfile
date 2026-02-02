# Password Manager - Dockerfile
FROM nginx:alpine

# Copy web files
COPY web/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
