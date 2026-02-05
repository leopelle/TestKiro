# Password Manager - Dockerfile
FROM nginx:alpine

# Add metadata
LABEL maintainer="Password Manager Team"
LABEL version="1.0.0"
LABEL description="Secure Password Manager Web Application"

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Copy web files
COPY web/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose ports
EXPOSE 80
EXPOSE 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
