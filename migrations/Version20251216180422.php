<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251216180422 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE feed_item (id INT AUTO_INCREMENT NOT NULL, feed_id INT NOT NULL, video_id INT NOT NULL, score DOUBLE PRECISION NOT NULL, created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', INDEX IDX_9F8CCE4951A5BC03 (feed_id), INDEX IDX_9F8CCE4929C1004E (video_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE feed_item ADD CONSTRAINT FK_9F8CCE4951A5BC03 FOREIGN KEY (feed_id) REFERENCES feed (id)');
        $this->addSql('ALTER TABLE feed_item ADD CONSTRAINT FK_9F8CCE4929C1004E FOREIGN KEY (video_id) REFERENCES video (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE feed_item DROP FOREIGN KEY FK_9F8CCE4951A5BC03');
        $this->addSql('ALTER TABLE feed_item DROP FOREIGN KEY FK_9F8CCE4929C1004E');
        $this->addSql('DROP TABLE feed_item');
    }
}
